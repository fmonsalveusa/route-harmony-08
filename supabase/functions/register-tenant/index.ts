import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REGISTER-TENANT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { email, password, fullName, companyName, plan, priceId } = await req.json();

    if (!email || !password || !fullName || !companyName) {
      throw new Error("Todos los campos son requeridos");
    }
    if (password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    logStep("Creating user", { email, fullName, companyName, plan });

    // 1. Create user via admin API (auto-confirms email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        throw new Error("Este email ya está registrado. Intenta iniciar sesión.");
      }
      throw new Error(authError.message);
    }

    const userId = authData.user?.id;
    if (!userId) throw new Error("Error creando la cuenta");
    logStep("User created", { userId });

    // 2. Create tenant
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: companyName,
        current_plan: plan || "basic",
        subscription_status: "pending",
      })
      .select("id")
      .single();

    if (tenantError) {
      logStep("Tenant creation error", { error: tenantError.message });
      throw new Error("Error creando la empresa");
    }

    const tenantId = tenantData.id;
    logStep("Tenant created", { tenantId });

    // 3. Update profile with tenant_id (profile created by trigger)
    // Wait briefly for the trigger to create the profile
    await new Promise((r) => setTimeout(r, 1000));

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: tenantId })
      .eq("id", userId);

    if (profileError) {
      logStep("Profile update error", { error: profileError.message });
    }

    // 4. Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin", tenant_id: tenantId });

    if (roleError) {
      logStep("Role assignment error", { error: roleError.message });
    }

    // 5. Create company record
    const { error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({ name: companyName, tenant_id: tenantId, is_primary: true });

    if (companyError) {
      logStep("Company creation error", { error: companyError.message });
    }

    logStep("All records created successfully");

    // 6. Create Stripe checkout session
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let checkoutUrl: string | null = null;

    if (stripeKey && priceId) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        const customers = await stripe.customers.list({ email, limit: 1 });
        let customerId: string | undefined;
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }

        const origin = req.headers.get("origin") || "https://route-harmony-08.lovable.app";

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          customer_email: customerId ? undefined : email,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: "subscription",
          subscription_data: {
            trial_period_days: 7,
            metadata: { tenant_id: tenantId, company_name: companyName },
          },
          success_url: `${origin}/dashboard?checkout=success`,
          cancel_url: `${origin}/pricing?checkout=canceled`,
          metadata: { tenant_id: tenantId },
        });

        checkoutUrl = session.url;
        logStep("Checkout session created", { sessionId: session.id });
      } catch (stripeErr: any) {
        logStep("Stripe error", { message: stripeErr.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, checkoutUrl, tenantId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

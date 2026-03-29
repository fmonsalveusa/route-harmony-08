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

const createCheckoutSession = async ({
  stripeKey,
  priceId,
  email,
  tenantId,
  companyName,
  origin,
}: {
  stripeKey: string;
  priceId?: string;
  email: string;
  tenantId: string;
  companyName: string;
  origin: string;
}) => {
  if (!priceId) return null;

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const customers = await stripe.customers.list({ email, limit: 1 });
  const customerId = customers.data[0]?.id;

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

  logStep("Checkout session created", { sessionId: session.id, tenantId });
  return session.url;
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanCompanyName = String(companyName).trim();
    const cleanFullName = String(fullName).trim();
    const origin = req.headers.get("origin") || "https://route-harmony-08.lovable.app";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    logStep("Creating user", { email: normalizedEmail, fullName: cleanFullName, companyName: cleanCompanyName, plan });

    let userId: string | null = null;
    let tenantId: string | null = null;
    let resumedExistingAccount = false;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: cleanFullName },
    });

    if (authError) {
      const isDuplicateEmail =
        authError.message.includes("already been registered") ||
        authError.message.includes("already exists") ||
        authError.message.includes("email address has already been registered");

      if (!isDuplicateEmail) {
        throw new Error(authError.message);
      }

      resumedExistingAccount = true;
      logStep("Existing account detected", { email: normalizedEmail });

      const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
        .from("profiles")
        .select("id, tenant_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error("No pudimos recuperar tu registro previo. Intenta iniciar sesión.");
      }

      if (!existingProfile?.id || !existingProfile.tenant_id) {
        throw new Error("Este email ya está registrado. Intenta iniciar sesión.");
      }

      userId = existingProfile.id;
      tenantId = existingProfile.tenant_id;

      const [tenantResult, subscriptionResult] = await Promise.all([
        supabaseAdmin
          .from("tenants")
          .select("id, name, subscription_status, stripe_subscription_id")
          .eq("id", tenantId)
          .maybeSingle(),
        supabaseAdmin
          .from("subscriptions")
          .select("id, status")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);

      const tenant = tenantResult.data;
      const subscription = subscriptionResult.data;
      const hasActiveBilling =
        Boolean(tenant?.stripe_subscription_id) ||
        ["active", "pending_payment"].includes(tenant?.subscription_status ?? "") ||
        ["active", "pending_payment"].includes(subscription?.status ?? "");

      if (!tenant?.id || hasActiveBilling) {
        throw new Error("Este email ya está registrado. Intenta iniciar sesión.");
      }

      cleanCompanyName || tenant.name;
      logStep("Resuming pending registration", { userId, tenantId });
    } else {
      userId = authData.user?.id ?? null;
      if (!userId) throw new Error("Error creando la cuenta");
      logStep("User created", { userId });

      const { data: tenantData, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: cleanCompanyName,
          current_plan: plan || "basic",
          subscription_status: "pending",
        })
        .select("id")
        .single();

      if (tenantError || !tenantData?.id) {
        logStep("Tenant creation error", { error: tenantError?.message });
        throw new Error("Error creando la empresa");
      }

      tenantId = tenantData.id;
      logStep("Tenant created", { tenantId });

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: normalizedEmail,
            full_name: cleanFullName,
            tenant_id: tenantId,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        logStep("Profile upsert error", { error: profileError.message });
      }

      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "admin", tenant_id: tenantId });

        if (roleError) {
          logStep("Role assignment error", { error: roleError.message });
        }
      }

      const { data: existingCompany } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_primary", true)
        .maybeSingle();

      if (!existingCompany) {
        const { error: companyError } = await supabaseAdmin
          .from("companies")
          .insert({ name: cleanCompanyName, tenant_id: tenantId, is_primary: true });

        if (companyError) {
          logStep("Company creation error", { error: companyError.message });
        }
      }

      logStep("Initial tenant records created", { tenantId });
    }

    let checkoutUrl: string | null = null;

    if (stripeKey && priceId && tenantId) {
      try {
        checkoutUrl = await createCheckoutSession({
          stripeKey,
          priceId,
          email: normalizedEmail,
          tenantId,
          companyName: cleanCompanyName,
          origin,
        });
      } catch (stripeErr: any) {
        logStep("Stripe error", { message: stripeErr.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, checkoutUrl, tenantId, resumedExistingAccount }),
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

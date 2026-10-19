import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { name, email, phone, truck_type, service_type, dispatch_service_client_mc, oo_mode, oo_email } = await req.json();

    if (!name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: "Nombre, email y teléfono son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the default tenant (first active tenant) for public landing page registrations
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (tenantError || !tenant) {
      console.error("No active tenant found:", tenantError);
      return new Response(
        JSON.stringify({ error: "No se pudo procesar la solicitud" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Si es dispatch_service y viene un MC number, intentar vincular a un client existente.
    // Si el MC no existe, devolvemos error para que el driver corrija o elija "empresa nueva".
    let dispatchServiceClientId: string | null = null;
    if (service_type === "dispatch_service" && dispatch_service_client_mc) {
      const mcClean = String(dispatch_service_client_mc).trim();
      const { data: client, error: clientError } = await supabaseAdmin
        .from("dispatch_service_clients")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("mc_number", mcClean)
        .maybeSingle();
      if (clientError) {
        console.error("Client lookup error:", clientError);
      }
      if (!client) {
        return new Response(
          JSON.stringify({ error: `No encontramos una empresa con MC# ${mcClean}. Verifica el número o selecciona "Nueva empresa".` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      dispatchServiceClientId = client.id;
    }

    // Owner Operator que ya trabaja con nosotros (driver nuevo o camión nuevo): se identifica por su email
    let existingInvestorId: string | null = null;
    let existingOwnerDriverId: string | null = null;
    const ooMode = service_type === "owner_operator" && ["add_driver", "add_truck"].includes(oo_mode) ? oo_mode : null;
    if (ooMode) {
      const ooEmail = String(oo_email ?? "").trim();
      if (!ooEmail) {
        return new Response(JSON.stringify({ error: "Escribe el email con el que estás registrado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: inv } = await supabaseAdmin.from("investors").select("id")
        .eq("tenant_id", tenant.id).ilike("email", ooEmail).limit(1).maybeSingle();
      if (inv) existingInvestorId = inv.id;
      else {
        const { data: drv } = await supabaseAdmin.from("drivers").select("id")
          .eq("tenant_id", tenant.id).eq("service_type", "owner_operator").neq("status", "inactive")
          .ilike("email", ooEmail).limit(1).maybeSingle();
        if (drv) existingOwnerDriverId = drv.id;
      }
      if (!existingInvestorId && !existingOwnerDriverId) {
        return new Response(
          JSON.stringify({ error: `No encontramos un Owner Operator registrado con ${ooEmail}. Verifica el email o elige "Soy nuevo".` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create onboarding token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from("onboarding_tokens")
      .insert({
        tenant_id: tenant.id,
        driver_name: name,
        driver_email: email,
        driver_phone: phone,
        truck_type: truck_type || null,
        service_type: service_type || "owner_operator",
        dispatch_service_client_id: dispatchServiceClientId,
        oo_mode: ooMode,
        existing_investor_id: existingInvestorId,
        existing_owner_driver_id: existingOwnerDriverId,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select("token")
      .single();

    if (tokenError || !tokenRecord) {
      console.error("Token creation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Error al crear el registro" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, token: tokenRecord.token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create token error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

    const { name, email, phone, truck_type } = await req.json();

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

    // Create onboarding token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from("onboarding_tokens")
      .insert({
        tenant_id: tenant.id,
        driver_name: name,
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

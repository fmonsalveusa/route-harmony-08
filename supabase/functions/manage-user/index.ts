import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin of the tenant
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("No autenticado");

    // Check caller role
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, is_master_admin")
      .eq("id", caller.id)
      .single();

    const isAdmin = callerProfile?.is_master_admin || callerRole?.role === "admin";
    if (!isAdmin) throw new Error("Sin permisos de administrador");

    const { action, ...payload } = await req.json();

    if (action === "create") {
      const { email, password, full_name, phone, role } = payload;
      if (!email || !password || !full_name || !role) {
        throw new Error("Campos requeridos: email, password, full_name, role");
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;
      const tenantId = callerProfile!.tenant_id;

      // Update profile with tenant_id and phone
      await supabaseAdmin
        .from("profiles")
        .update({ tenant_id: tenantId, phone: phone || null })
        .eq("id", userId);

      // Set role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role, tenant_id: tenantId });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { user_id, full_name, phone, role, is_active, password } = payload;
      if (!user_id) throw new Error("user_id requerido");

      // Verify target user belongs to same tenant
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", user_id)
        .single();

      if (!callerProfile?.is_master_admin && targetProfile?.tenant_id !== callerProfile?.tenant_id) {
        throw new Error("No puedes editar usuarios de otro tenant");
      }

      // Update profile
      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (is_active !== undefined) profileUpdates.is_active = is_active;

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin.from("profiles").update(profileUpdates).eq("id", user_id);
      }

      // Update role
      if (role) {
        await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", user_id);
      }

      // Update password if provided
      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      }

      // Update email in auth if full_name changed (metadata)
      if (full_name) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Acción no válida");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

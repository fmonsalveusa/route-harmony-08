import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["admin", "accounting", "dispatcher", "driver"];

function validateCreateInput(payload: Record<string, unknown>) {
  const errors: string[] = [];
  const { email, password, full_name, phone, role } = payload;

  if (!email || typeof email !== "string") {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Invalid email format");
  } else if (email.length > 255) {
    errors.push("Email too long (max 255 characters)");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  } else if ((password as string).length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if ((password as string).length > 72) {
    errors.push("Password too long (max 72 characters)");
  }

  if (!full_name || typeof full_name !== "string") {
    errors.push("Full name is required");
  } else if ((full_name as string).length < 2) {
    errors.push("Full name too short (min 2 characters)");
  } else if ((full_name as string).length > 100) {
    errors.push("Full name too long (max 100 characters)");
  }

  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string" || (phone as string).length > 20) {
      errors.push("Phone must be a string (max 20 characters)");
    }
  }

  if (!role || typeof role !== "string" || !VALID_ROLES.includes(role as string)) {
    errors.push(`Role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  if (errors.length > 0) throw new Error(errors.join("; "));
}

function validateUpdateInput(payload: Record<string, unknown>) {
  const errors: string[] = [];
  const { user_id, full_name, phone, role, password } = payload;

  if (!user_id || typeof user_id !== "string" || !UUID_REGEX.test(user_id as string)) {
    errors.push("Valid user_id is required");
  }

  if (full_name !== undefined) {
    if (typeof full_name !== "string" || (full_name as string).length < 2 || (full_name as string).length > 100) {
      errors.push("Full name must be 2-100 characters");
    }
  }

  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string" || (phone as string).length > 20) {
      errors.push("Phone must be a string (max 20 characters)");
    }
  }

  if (role !== undefined) {
    if (typeof role !== "string" || !VALID_ROLES.includes(role as string)) {
      errors.push(`Role must be one of: ${VALID_ROLES.join(", ")}`);
    }
  }

  if (password !== undefined) {
    if (typeof password !== "string" || (password as string).length < 8 || (password as string).length > 72) {
      errors.push("Password must be 8-72 characters");
    }
  }

  if (errors.length > 0) throw new Error(errors.join("; "));
}

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
    if (!caller) throw new Error("Not authenticated");

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
    if (!isAdmin) throw new Error("Admin permissions required");

    const { action, ...payload } = await req.json();

    if (action === "create") {
      validateCreateInput(payload);
      const { email, password, full_name, phone, role } = payload;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;
      const tenantId = callerProfile!.tenant_id;

      await supabaseAdmin
        .from("profiles")
        .update({ tenant_id: tenantId, phone: phone || null })
        .eq("id", userId);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role, tenant_id: tenantId });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      validateUpdateInput(payload);
      const { user_id, full_name, phone, role, is_active, password } = payload;

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", user_id)
        .single();

      if (!callerProfile?.is_master_admin && targetProfile?.tenant_id !== callerProfile?.tenant_id) {
        throw new Error("Cannot edit users from another tenant");
      }

      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (is_active !== undefined) profileUpdates.is_active = is_active;

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin.from("profiles").update(profileUpdates).eq("id", user_id);
      }

      if (role) {
        await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", user_id);
      }

      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      }

      if (full_name) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
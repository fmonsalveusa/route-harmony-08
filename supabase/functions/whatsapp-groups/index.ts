import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logMessage } from "../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WHAPI = "https://gate.whapi.cloud";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: "Unauthorized" }, 401);

  const whapiToken = Deno.env.get("WHAPI_TOKEN");
  if (!whapiToken) return json({ error: "WHAPI_TOKEN not configured" }, 500);
  const auth = { Authorization: `Bearer ${whapiToken}`, "Content-Type": "application/json" };

  try {
    const { action, group_id } = await req.json().catch(() => ({}));

    // Estado de la conexión del número en Whapi
    if (action === "status") {
      const res = await fetch(`${WHAPI}/health`, { headers: auth });
      if (!res.ok) return json({ connected: false, status: `HTTP ${res.status}` });
      const health = await res.json().catch(() => ({}));
      const text = String(health?.status?.text ?? health?.status ?? "UNKNOWN");
      let phone: string | null = null;
      try {
        const me = await fetch(`${WHAPI}/users/profile`, { headers: auth });
        if (me.ok) {
          const profile = await me.json();
          phone = profile?.phone ?? profile?.id ?? null;
        }
      } catch { /* el perfil es opcional */ }
      return json({ connected: text.toUpperCase() === "AUTH", status: text, phone });
    }

    // Mensaje de prueba a un grupo
    if (action === "test") {
      if (!group_id) return json({ error: "group_id required" }, 400);
      const message = "Mensaje de prueba de Dispatch Up. Las notificaciones llegarán a este grupo.";
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const log = { tenantId: profile?.tenant_id ?? null, templateKey: "test", recipientType: "test", groupId: group_id, message, reference: "Botón Probar" };
      const res = await fetch(`${WHAPI}/messages/text`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ to: group_id, body: message }),
      });
      if (!res.ok) {
        const err = `Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
        await logMessage(supabase, log, "failed", err);
        throw new Error(err);
      }
      await logMessage(supabase, log, "sent");
      return json({ success: true });
    }

    // Lista de grupos donde está el número conectado
    const res = await fetch(`${WHAPI}/groups?count=500`, { headers: auth });
    if (!res.ok) throw new Error(`Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const payload = await res.json();
    const groups = ((payload?.groups ?? []) as any[])
      .map((g) => ({ id: g.id as string, name: (g.name || g.subject || g.id) as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({ groups });
  } catch (e) {
    console.error("whatsapp-groups error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

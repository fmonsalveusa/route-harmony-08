import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAccountError, logMessage } from "../_shared/messaging.ts";
import { renderTemplate } from "../_shared/templateDefaults.ts";

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
    const body = await req.json().catch(() => ({}));
    const { action, group_id } = body;

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
      // El número puede figurar conectado aunque Whapi rechace los envíos (límite, pago, token).
      // Si el último error de cuenta es más reciente que el último envío exitoso, está bloqueado.
      let blocked: { error: string; at: string } | null = null;
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      if (profile?.tenant_id) {
        const since = new Date(Date.now() - 48 * 3600_000).toISOString();
        const [{ data: lastFailed }, { data: lastSent }] = await Promise.all([
          supabase.from("whatsapp_message_history").select("error, created_at")
            .eq("tenant_id", profile.tenant_id).eq("status", "failed").gte("created_at", since)
            .order("created_at", { ascending: false }).limit(10),
          supabase.from("whatsapp_message_history").select("created_at")
            .eq("tenant_id", profile.tenant_id).eq("status", "sent")
            .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        const accountFailure = ((lastFailed as any[]) || []).find((f) => isAccountError(f.error || ""));
        if (accountFailure && (!lastSent || accountFailure.created_at > lastSent.created_at)) {
          blocked = { error: accountFailure.error, at: accountFailure.created_at };
        }
      }

      return json({ connected: text.toUpperCase() === "AUTH" && !blocked, status: text, phone, blocked });
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

    // Mensaje masivo a los grupos elegidos, con imagen o archivo opcional
    if (action === "broadcast") {
      const { group_ids, message, media_url, media_type, filename } = body;
      const groups = (group_ids ?? []) as { id: string; name?: string; person?: string }[];
      if (groups.length === 0) return json({ error: "Elige al menos un grupo" }, 400);
      if (!message?.trim() && !media_url) return json({ error: "Escribe un mensaje o adjunta un archivo" }, 400);

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const tenantId = profile?.tenant_id ?? null;
      const text = (message ?? "").trim();

      const results: { id: string; name?: string; ok: boolean; error?: string }[] = [];
      for (const g of groups) {
        // {driver} y {nombre} se reemplazan con el dueño de cada grupo
        const persona = (g.person ?? "").trim();
        const body = renderTemplate(text, { driver: persona, nombre: persona.split(/\s+/)[0] ?? "" });
        const log = {
          tenantId, templateKey: "broadcast", recipientType: "broadcast",
          recipientName: g.name ?? null, groupId: g.id, message: body, reference: media_url ? "Con archivo" : null,
        };
        try {
          const path = media_url ? (media_type === "image" ? "/messages/image" : "/messages/document") : "/messages/text";
          const payload = media_url
            ? media_type === "image"
              ? { to: g.id, media: media_url, caption: body }
              : { to: g.id, media: media_url, filename: filename ?? "archivo", caption: body }
            : { to: g.id, body };
          const send = await fetch(`${WHAPI}${path}`, { method: "POST", headers: auth, body: JSON.stringify(payload) });
          if (!send.ok) throw new Error(`Whapi HTTP ${send.status}: ${(await send.text()).slice(0, 200)}`);
          await logMessage(supabase, log, "sent");
          results.push({ id: g.id, name: g.name, ok: true });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          await logMessage(supabase, log, "failed", error);
          results.push({ id: g.id, name: g.name, ok: false, error });
        }
        // Espaciar los envíos para no parecer spam
        if (groups.indexOf(g) < groups.length - 1) await new Promise((r) => setTimeout(r, 1500));
      }
      return json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), results });
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

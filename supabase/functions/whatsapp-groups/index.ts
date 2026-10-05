import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAccountError, isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";
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
      if (!String(group_id).endsWith("@g.us")) return json({ error: "Solo se envían mensajes a grupos" }, 400);
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
      const groups = ((group_ids ?? []) as { id: string; name?: string; person?: string }[])
        .filter((g) => String(g.id).endsWith("@g.us")); // solo grupos
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

    // CRM: crear el grupo del cliente / enviar un paso de la reunión
    if (action === "crm_create_group" || action === "crm_send_step") {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      const { data: contact } = await supabase.from("crm_contacts").select("*").eq("id", body.contact_id).maybeSingle();
      if (!contact || contact.tenant_id !== profile?.tenant_id) return json({ error: "Contacto no encontrado" }, 404);
      const note = (text: string) => supabase.from("crm_notes").insert({
        tenant_id: contact.tenant_id, contact_id: contact.id, kind: "system", body: text, created_by: user.id,
      });

      if (action === "crm_create_group") {
        // Desactivado: crear grupos por API agregando números nuevos arriesga el bloqueo del número
        return json({ error: "Crear grupos desde el TMS está desactivado. Créalo desde el teléfono y vincúlalo." }, 400);
        if (contact.whatsapp_group_id) return json({ error: "Este cliente ya tiene grupo" }, 400);
        const subject = String(body.subject ?? "").trim().slice(0, 100);
        if (!subject) return json({ error: "Escribe el nombre del grupo" }, 400);
        const digits = String(contact.phone ?? "").replace(/\D/g, "");
        if (digits.length < 10) return json({ error: "El cliente no tiene un teléfono válido" }, 400);
        const participant = digits.length === 10 ? `1${digits}` : digits;

        const res = await fetch(`${WHAPI}/groups`, { method: "POST", headers: auth, body: JSON.stringify({ subject, participants: [participant] }) });
        const created = await res.json().catch(() => ({}));
        if (!res.ok) return json({ error: `Whapi HTTP ${res.status}: ${JSON.stringify(created).slice(0, 300)}` }, 502);
        const groupId = created?.group_id ?? created?.id ?? created?.group?.id;
        if (!groupId) return json({ error: `Whapi no devolvió el grupo: ${JSON.stringify(created).slice(0, 300)}` }, 502);

        await supabase.from("crm_contacts").update({ whatsapp_group_id: groupId, whatsapp_group_name: subject }).eq("id", contact.id);
        await note(`Grupo de WhatsApp creado: ${subject}`);
        return json({ group_id: groupId, name: subject });
      }

      const STEPS: Record<string, { key: string; label: string }> = {
        service_info: { key: "crm_step_service_info", label: "Información del Servicio" },
        medical_card: { key: "crm_step_medical_card", label: "Medical Card" },
        eld: { key: "crm_step_eld", label: "Libro Electrónico MC# Nuestro" },
        eld_own_mc: { key: "crm_step_eld_own_mc", label: "Libro Electrónico MC# Propio" },
      };
      const step = STEPS[String(body.step)];
      if (!step) return json({ error: "Paso desconocido" }, 400);
      if (!contact.whatsapp_group_id) return json({ error: "Primero crea el grupo de WhatsApp" }, 400);
      if (!(await isEnabled(supabase, contact.tenant_id, "wa_crm_meeting"))) return json({ error: "El envío está apagado en Automatizaciones" }, 400);
      // El texto original es solo un ejemplo: no se envía hasta que lo escriban
      const { data: custom } = await supabase.from("whatsapp_templates").select("body")
        .eq("tenant_id", contact.tenant_id).eq("template_key", step.key).maybeSingle();
      if (!custom?.body?.trim()) {
        return json({ error: `Primero escribe el texto de "${step.label}" en WhatsApp → Automatizaciones → Reunión del CRM` }, 400);
      }
      const name = String(contact.name ?? "").trim();
      const message = await renderMessage(supabase, contact.tenant_id, step.key, { nombre: name.split(/\s+/)[0] ?? "", cliente: name });
      await sendTextLogged(supabase, {
        tenantId: contact.tenant_id, templateKey: step.key, recipientType: "lead",
        recipientName: name, groupId: contact.whatsapp_group_id, message, reference: `CRM · ${step.label}`,
      });

      const meeting = (contact.meeting ?? {}) as { checks?: Record<string, boolean>; sent?: Record<string, string> };
      const sentAt = new Date().toISOString();
      await supabase.from("crm_contacts").update({
        meeting: { ...meeting, checks: { ...(meeting.checks ?? {}), [body.step]: true }, sent: { ...(meeting.sent ?? {}), [body.step]: sentAt } },
      }).eq("id", contact.id);
      await note(`Enviado por WhatsApp: ${step.label}`);
      return json({ success: true, sent_at: sentAt });
    }

    // Lista de grupos donde está el número conectado
    const res = await fetch(`${WHAPI}/groups?count=500`, { headers: auth });
    if (!res.ok) throw new Error(`Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const payload = await res.json();
    // Los grupos archivados en el teléfono (clientes que ya no trabajan) no se muestran
    const archived = new Set<string>();
    try {
      for (let offset = 0; offset < 3000; offset += 500) {
        const chatsRes = await fetch(`${WHAPI}/chats?count=500&offset=${offset}`, { headers: auth });
        if (!chatsRes.ok) break;
        const chats = ((await chatsRes.json())?.chats ?? []) as any[];
        for (const c of chats) if (c?.archive === true || c?.archived === true) archived.add(String(c.id));
        if (chats.length < 500) break;
      }
    } catch (e) {
      console.error("archived chats lookup failed:", e);
    }
    const groups = ((payload?.groups ?? []) as any[])
      .filter((g) => body.include_archived || !archived.has(String(g.id)))
      .map((g) => ({ id: g.id as string, name: (g.name || g.subject || g.id) as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // Todos los grupos donde está el número (incluidos archivados), para avisar de grupos asignados donde ya no está
    const memberIds = ((payload?.groups ?? []) as any[]).map((g) => String(g.id));
    return json({ groups, member_ids: memberIds });
  } catch (e) {
    console.error("whatsapp-groups error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

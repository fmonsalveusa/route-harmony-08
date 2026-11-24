// deno-lint-ignore-file no-explicit-any
// Email al broker desde la extensión de DAT ("✉ Email" en el detalle de la carga): se envía
// directo por Gmail (SMTP con App Password) desde la cuenta de brokers de 58 Logistics.
// Autenticación: la clave del tenant (integration_keys, kind 'rts_assistant' o 'dat_extension')
// en el header x-assistant-key — la misma clave del asistente de RTS.
//  • { action: "send", to, subject, body, posting_id?, broker?, broker_mc?, origin?, destination? }
//  • { action: "check" }  → si la cuenta de envío está configurada
//  • { action: "sent", posting_ids }  → cuáles de esas cargas ya tienen email enviado (últimos 7 días)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendMail } from "../_shared/smtp.ts";
import { gmailAccounts } from "../_shared/gmail.ts";

// Cuenta por defecto; la extensión puede elegir otra de las configuradas (BROKER_/EXTRA_GMAIL_ACCOUNTS)
const FROM = "58logisticsllc@gmail.com";
const KNOWN_NAMES: Record<string, string> = { "58logisticsllc@gmail.com": "58 Logistics LLC" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-assistant-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const key = req.headers.get("x-assistant-key")?.trim();
    if (!key) return json({ error: "Falta la clave de Dispatch Up (configúrala en ⚙ de la extensión)" }, 401);
    const { data: k } = await supabase.from("integration_keys").select("tenant_id")
      .in("kind", ["rts_assistant", "dat_extension"]).eq("key", key).maybeSingle();
    if (!k) return json({ error: "Clave inválida. Cópiala de nuevo desde el TMS (Companies → Asistente RTS)." }, 401);
    const tenantId = k.tenant_id;
    const body = await req.json().catch(() => ({}));

    if (body.action === "sent") {
      const ids = (Array.isArray(body.posting_ids) ? body.posting_ids : []).map(String).slice(0, 300);
      if (!ids.length) return json({ sent: {} });
      const { data } = await supabase.from("dat_broker_emails").select("posting_id, created_at")
        .eq("tenant_id", tenantId).eq("status", "sent").in("posting_id", ids)
        .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
      const sent: Record<string, string> = {};
      for (const r of (data as any[]) || []) if (!sent[r.posting_id] || r.created_at > sent[r.posting_id]) sent[r.posting_id] = r.created_at;
      return json({ sent });
    }

    // La extensión revisa al guardar la configuración que la cuenta esté lista
    if (body.action === "check") {
      const accounts = gmailAccounts().map((a) => a.user);
      return json({ ok: true, from: FROM, ready: accounts.includes(FROM), accounts });
    }

    if (body.action !== "send") return json({ error: "Acción desconocida" }, 400);

    const to = String(body.to || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim().slice(0, 300);
    const text = String(body.body || "").trim().slice(0, 10000);
    if (!EMAIL_RE.test(to)) return json({ error: "Email del broker no válido" }, 400);
    if (!subject || !text) return json({ error: "Falta el asunto o el mensaje" }, 400);

    const wanted = String(body.from || FROM).trim().toLowerCase();
    const account = gmailAccounts().find((a) => a.user === wanted);
    if (!account) return json({ error: `La cuenta ${wanted} no está configurada para enviar (falta su App Password)` }, 400);
    const fromName = String(body.fromName || "").trim().slice(0, 80) || KNOWN_NAMES[account.user] || "";

    const row = {
      tenant_id: tenantId, to_email: to, from_email: account.user, subject, body: text,
      posting_id: body.posting_id ? String(body.posting_id) : null,
      broker: body.broker ? String(body.broker).slice(0, 200) : null,
      broker_mc: body.broker_mc ? String(body.broker_mc).slice(0, 20) : null,
      origin: body.origin ? String(body.origin).slice(0, 120) : null,
      destination: body.destination ? String(body.destination).slice(0, 120) : null,
    };

    try {
      // Versión HTML con los mismos saltos de línea de la plantilla (Gmail muestra esta)
      const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f1f1f">${
        esc(text).replace(/\r?\n/g, "<br>")
      }</div>`;
      await sendMail(account, { fromName, to: [to], subject, text, html });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await supabase.from("dat_broker_emails").insert({ ...row, status: "failed", error: error.slice(0, 500) });
      return json({ error: `Gmail no lo envió: ${error.slice(0, 200)}` }, 502);
    }
    await supabase.from("dat_broker_emails").insert(row);
    return json({ ok: true, from: account.user });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// deno-lint-ignore-file no-explicit-any
import { DEFAULT_TEMPLATES, renderTemplate } from "./templateDefaults.ts";
import { sendWhapiText, sendWhapiDocument } from "./whapi.ts";

type Vars = Record<string, string | number | null | undefined>;

export interface MessageLog {
  tenantId: string | null;
  templateKey: string;
  recipientType?: string | null;
  recipientName?: string | null;
  groupId?: string | null;
  message?: string | null;
  reference?: string | null;
}

/** Texto del aviso: el editado por el tenant o el original del sistema */
export async function renderMessage(supabase: any, tenantId: string | null, key: string, vars: Vars): Promise<string> {
  let body = DEFAULT_TEMPLATES[key] ?? "";
  if (tenantId) {
    const { data } = await supabase
      .from("whatsapp_templates").select("body")
      .eq("tenant_id", tenantId).eq("template_key", key).maybeSingle();
    if (data?.body?.trim()) body = data.body;
  }
  return renderTemplate(body, vars);
}

/** true si el interruptor del aviso está encendido (encendido por defecto) */
export async function isEnabled(supabase: any, tenantId: string | null, toggle: string): Promise<boolean> {
  if (!tenantId) return true;
  const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
  return data?.[toggle] !== false;
}

export async function logMessage(supabase: any, log: MessageLog, status: "sent" | "failed" | "skipped", error?: string) {
  try {
    await supabase.from("whatsapp_message_history").insert({
      tenant_id: log.tenantId,
      template_key: log.templateKey,
      recipient_type: log.recipientType ?? null,
      recipient_name: log.recipientName ?? null,
      group_id: log.groupId ?? null,
      message: log.message ?? null,
      status,
      error: error ?? null,
      reference: log.reference ?? null,
    });
  } catch (e) {
    console.error("history log failed:", e);
  }
}

/** Errores de la cuenta de Whapi (pago, límite, token, desconexión): afectan a todos los avisos */
export function isAccountError(message: string): boolean {
  return /HTTP (401|402|403)\b|limit exceeded|trial|payment|subscription|unauthori[sz]ed|not authorized|forbidden/i.test(message);
}

/** Notificación en el TMS cuando la cuenta de Whapi bloquea envíos (máximo una cada 6 horas) */
async function notifyAccountError(supabase: any, tenantId: string | null, error: string) {
  if (!tenantId || !isAccountError(error)) return;
  try {
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from("notifications").select("id")
      .eq("tenant_id", tenantId).eq("type", "whatsapp_error").gte("created_at", since).limit(1);
    if (recent && recent.length > 0) return;

    const reason = /402|limit|trial|payment|subscription/i.test(error)
      ? "Whapi rechazó el envío por límite de mensajes o falta de pago. Revisa el plan en whapi.cloud."
      : "Whapi rechazó el envío por un problema de autorización. Revisa el token o vuelve a conectar el número en whapi.cloud.";

    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      type: "whatsapp_error",
      title: "WhatsApp: no se están enviando mensajes",
      message: `${reason} Detalle: ${error.slice(0, 200)}`,
    });
  } catch (e) {
    console.error("notifyAccountError failed:", e);
  }
}

/** Envía texto y lo registra en el historial. Lanza el error si falla. */
export async function sendTextLogged(supabase: any, log: MessageLog & { groupId: string; message: string }) {
  try {
    await sendWhapiText(log.groupId, log.message);
    await logMessage(supabase, log, "sent");
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await logMessage(supabase, log, "failed", error);
    await notifyAccountError(supabase, log.tenantId, error);
    throw e;
  }
}

/** Envía documento y lo registra en el historial. Lanza el error si falla. */
export async function sendDocumentLogged(
  supabase: any,
  log: MessageLog & { groupId: string; message: string },
  mediaUrl: string,
  filename: string,
) {
  try {
    await sendWhapiDocument(log.groupId, mediaUrl, filename, log.message);
    await logMessage(supabase, log, "sent");
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await logMessage(supabase, log, "failed", error);
    await notifyAccountError(supabase, log.tenantId, error);
    throw e;
  }
}

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

/** Envía texto y lo registra en el historial. Lanza el error si falla. */
export async function sendTextLogged(supabase: any, log: MessageLog & { groupId: string; message: string }) {
  try {
    await sendWhapiText(log.groupId, log.message);
    await logMessage(supabase, log, "sent");
  } catch (e) {
    await logMessage(supabase, log, "failed", e instanceof Error ? e.message : String(e));
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
    await logMessage(supabase, log, "failed", e instanceof Error ? e.message : String(e));
    throw e;
  }
}

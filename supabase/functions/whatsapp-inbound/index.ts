// deno-lint-ignore-file no-explicit-any
// Respuesta automática a quien escribe al WhatsApp de la empresa.
// Whapi manda cada mensaje entrante a esta función (webhook). Solo contesta a números
// desconocidos en chats 1 a 1: a drivers, investors y dispatchers no les responde nada.
// También recibe el evento "groups": cuando se crea un grupo nuevo, manda la bienvenida.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhapiText } from "../_shared/whapi.ts";
import { isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MEETING_LINK = "https://www.dispatch-up.com/#meeting";
const MAX_REPLIES_PER_DAY = 8;      // tope por persona, para no quedar en un ida y vuelta infinito
const VEHICLES_OK = "box truck (24 o 26 pies) y hotshot (pickup con gooseneck o dually)";
const VEHICLES_NO = "cargo van, sprinter, semi o tracto camión, dry van de 53 pies, flatbed y power only";

const digits = (s: string) => (s ?? "").replace(/\D/g, "");
/** Los teléfonos se comparan por los últimos 10 dígitos: el formato varía mucho */
const last10 = (s: string) => digits(s).slice(-10);

const HISTORY_LIMIT = 30;           // mensajes que se guardan por contacto (memoria entre días)

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Dispatch Up, empresa de dispatch de carga en Estados Unidos (Charlotte, NC).
Contestas a personas que escriben por primera vez preguntando por los servicios.

SERVICIOS: dispatch para quien tiene su propio MC#, leasing bajo el MC# de Dispatch Up, trámite de permisos (DOT, MC#, IFTA), curso de dispatcher, TMS y app de tracking, y asesoría.

VEHÍCULOS CON LOS QUE SÍ TRABAJAMOS: ${VEHICLES_OK}.
VEHÍCULOS CON LOS QUE NO TRABAJAMOS: ${VEHICLES_NO}.

NO ESCRIBES MENSAJES. Solo lees lo que dice la persona y eliges una de estas acciones.
El sistema se encarga de enviar el texto que corresponda.

0. "faq" — la pregunta se contesta exactamente con una de las PREGUNTAS FRECUENTES de abajo. Indica su código en faq_id.
1. "qualified" — dijo que tiene box truck o hotshot, o pregunta por permisos, DOT, MC#, curso de dispatcher, TMS, leasing o asesoría.
2. "ask_vehicle" — muestra interés en el servicio pero todavía no sabes qué vehículo tiene. Es el caso más común en el primer mensaje.
3. "not_supported" — dijo que tiene un vehículo de los que NO trabajamos.
4. "human" — pregunta precios, quiere negociar, reclama algo, ya es cliente, o el tema se sale de todo lo anterior.

Ante la duda entre "ask_vehicle" y otra, elige "ask_vehicle".
Usa "faq" solo si una pregunta frecuente responde de verdad lo que preguntó; si pregunta precios y no hay una pregunta frecuente de precios, es "human".
Si vuelve a preguntar algo que ya se le respondió en la conversación, es "human".
Indica también el idioma en que escribe la persona: "es" o "en".
En "summary" deja el resumen actualizado de lo que se sabe de la persona (vehículo, ciudad, experiencia, MC#, qué busca, qué se le envió), en pocas líneas. Es la memoria para las próximas conversaciones.`;

type Action = "faq" | "qualified" | "ask_vehicle" | "not_supported" | "human";

interface Classification {
  action: Action;
  faq_id: string;
  language: string;
  vehicle: string;
  service: string;
  summary: string;
}

interface Knowledge {
  id: string;
  question: string;
  answer: string;
  answer_en: string | null;
}

type HistoryItem = { role: string; content: string; at?: string };

const fmtWhen = (iso?: string) => iso
  ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" })
  : "";

/** Prompt base + preguntas frecuentes + lo que ya se sabe del contacto */
function buildSystem(knowledge: Knowledge[], lead: any, crm: string): string {
  const parts = [SYSTEM_PROMPT];
  if (knowledge.length > 0) {
    parts.push("PREGUNTAS FRECUENTES (código: tema):\n" + knowledge.map((k, i) => `F${i + 1}: ${k.question}`).join("\n"));
  }
  const memory = [
    lead?.summary ? `Resumen: ${lead.summary}` : "",
    lead?.vehicle ? `Vehículo: ${lead.vehicle}` : "",
    lead?.service ? `Interés: ${lead.service}` : "",
    lead?.last_message_at ? `Último mensaje anterior: ${fmtWhen(lead.last_message_at)} (hora del Este)` : "",
    crm,
  ].filter(Boolean);
  parts.push(memory.length > 0
    ? "LO QUE YA SABEMOS DE ESTA PERSONA (de conversaciones anteriores):\n" + memory.join("\n")
    : "Es la primera vez que escribe.");
  return parts.join("\n\n");
}

/** Etapa del CRM y reunión agendada, si la persona ya está en el CRM */
async function crmContext(supabase: any, tenantId: string, phone: string): Promise<string> {
  const key = last10(phone);
  if (key.length < 10) return "";
  const [{ data: contact }, { data: meetings }] = await Promise.all([
    supabase.from("crm_contacts").select("stage").eq("tenant_id", tenantId).eq("phone_key", key).limit(1).maybeSingle(),
    supabase.from("meeting_requests").select("phone, meeting_date, meeting_time, status")
      .gte("meeting_date", new Date().toISOString().slice(0, 10)).neq("status", "cancelled"),
  ]);
  const meeting = ((meetings as any[]) || []).find((m) => last10(m.phone) === key);
  return [
    contact?.stage ? `Etapa en el CRM: ${contact.stage}` : "",
    meeting ? `Tiene reunión agendada: ${meeting.meeting_date} ${meeting.meeting_time ?? ""}` : "",
  ].filter(Boolean).join("\n");
}

async function askAssistant(system: string, history: HistoryItem[], faqCount: number): Promise<Classification | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system,
        tools: [{
          name: "responder",
          description: "Responde al mensaje de WhatsApp y clasifica la consulta",
          input_schema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["faq", "qualified", "ask_vehicle", "not_supported", "human"], description: "Qué corresponde hacer" },
              faq_id: { type: "string", enum: ["", ...Array.from({ length: faqCount }, (_, i) => `F${i + 1}`)], description: "Código de la pregunta frecuente si action es faq; si no, vacío" },
              language: { type: "string", enum: ["es", "en"], description: "Idioma en que escribe la persona" },
              vehicle: { type: "string", description: "Tipo de vehículo mencionado, o vacío si no lo dijo" },
              service: { type: "string", description: "Servicio que le interesa, o vacío si no está claro" },
              summary: { type: "string", description: "Resumen actualizado de lo que se sabe de la persona" },
            },
            required: ["action", "faq_id", "language", "vehicle", "service", "summary"],
          },
        }],
        tool_choice: { type: "tool", name: "responder" },
        // La fecha delante de cada mensaje le dice a la IA cuánto tiempo pasó entre uno y otro
        messages: history.map((h) => ({ role: h.role, content: h.at ? `[${fmtWhen(h.at)}] ${h.content}` : h.content })),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const input = (data.content ?? []).find((c: any) => c.type === "tool_use")?.input;
    return input?.action ? (input as Classification) : null;
  } catch (e) {
    console.error("askAssistant failed:", e);
    return null;
  }
}

/** ¿El número ya está en el TMS? A esos no les contesta el asistente */
async function isKnownContact(supabase: any, phone: string): Promise<boolean> {
  const tail = last10(phone);
  if (tail.length < 10) return false;
  for (const table of ["drivers", "investors", "dispatchers"]) {
    const { data } = await supabase.from(table).select("phone").not("phone", "is", null);
    if (((data as any[]) || []).some((r) => last10(r.phone) === tail)) return true;
  }
  return false;
}

async function notifyAdmin(supabase: any, tenant: any, text: string, name: string) {
  if (!tenant?.whatsapp_admin_group_id) return;
  try {
    await sendWhapiText(tenant.whatsapp_admin_group_id, text);
    await logMessage(supabase, {
      tenantId: tenant.id, templateKey: "inbound_lead", recipientType: "admin",
      recipientName: name, groupId: tenant.whatsapp_admin_group_id, message: text, reference: "WhatsApp entrante",
    }, "sent");
  } catch (e) {
    console.error("notifyAdmin failed:", e);
  }
}

/** Bienvenida al grupo recién creado: una sola vez por grupo, con el nombre del driver que está adentro */
async function welcomeGroup(supabase: any, tenant: any, group: any) {
  const groupId = String(group?.id ?? "");
  if (!groupId.includes("@g.us")) return { group: groupId, skipped: "no es un grupo" };
  if (groupId === tenant.whatsapp_admin_group_id) return { group: groupId, skipped: "grupo de administración" };
  if (!(await isEnabled(supabase, tenant.id, "wa_group_welcome"))) return { group: groupId, skipped: "bienvenida apagada" };

  const { data: already } = await supabase
    .from("whatsapp_message_history").select("id")
    .eq("template_key", "group_welcome").eq("group_id", groupId).eq("status", "sent").limit(1);
  if (already && already.length > 0) return { group: groupId, skipped: "ya se envió" };

  const phones = ((group?.participants ?? []) as any[]).map((p) => last10(String(p?.id ?? p ?? ""))).filter((p) => p.length === 10);
  let driverName = "";
  if (phones.length > 0) {
    const { data: drivers } = await supabase.from("drivers").select("name, phone").not("phone", "is", null);
    driverName = ((drivers as any[]) || []).find((d) => phones.includes(last10(d.phone)))?.name ?? "";
    // Grupos creados desde el CRM: el cliente todavía no es driver
    if (!driverName) {
      const { data: contacts } = await supabase.from("crm_contacts").select("name, phone_key")
        .eq("tenant_id", tenant.id).in("phone_key", phones);
      driverName = ((contacts as any[]) || [])[0]?.name ?? "";
    }
  }

  const groupName = String(group?.name ?? group?.subject ?? "");
  const message = (await renderMessage(supabase, tenant.id, "group_welcome", {
    nombre: driverName.trim().split(/\s+/)[0] || "Hola",
    driver: driverName,
    grupo: groupName,
  })).trim();
  if (!message) return { group: groupId, skipped: "mensaje vacío" };

  try {
    await sendTextLogged(supabase, {
      tenantId: tenant.id, templateKey: "group_welcome", recipientType: "driver",
      recipientName: driverName || groupName || groupId, groupId, message, reference: "Grupo nuevo",
    });
    return { group: groupId, welcomed: true };
  } catch (e) {
    return { group: groupId, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("CRON_SECRET");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const messages = (body?.messages ?? []) as any[];
    const results: unknown[] = [];

    // Puede haber varios tenants: el bueno es el que tiene el grupo de administración configurado
    const cols = "id, whatsapp_admin_group_id, wa_inbound_assistant";
    let { data: tenant, error: tenantErr } = await supabase
      .from("tenants").select(cols).not("whatsapp_admin_group_id", "is", null).limit(1).maybeSingle();
    if (!tenant && !tenantErr) {
      ({ data: tenant, error: tenantErr } = await supabase.from("tenants").select(cols).limit(1).maybeSingle());
    }
    if (tenantErr) {
      console.error("tenants query failed:", tenantErr);
      return json({ error: `No se pudo leer el tenant: ${tenantErr.message}` }, 500);
    }
    if (!tenant) return json({ error: "No hay tenant configurado" }, 500);

    // Evento de grupo nuevo (webhook "groups" de Whapi): mensaje de bienvenida
    const groups = (body?.groups ?? []) as any[];
    const groupEvent = String(body?.event?.event ?? "post").toLowerCase();
    if (groups.length > 0 && groupEvent === "post") {
      for (const g of groups) results.push(await welcomeGroup(supabase, tenant, g));
    }

    if (messages.length === 0) return json({ results });
    if (tenant.wa_inbound_assistant === false) return json({ results, skipped: "asistente apagado" });

    // Los mensajes procesados hace más de 7 días ya no hace falta recordarlos
    await supabase.from("whatsapp_inbound_seen").delete().lt("created_at", new Date(Date.now() - 7 * 864e5).toISOString());

    const { data: knowledgeRows } = await supabase
      .from("whatsapp_knowledge").select("id, question, answer, answer_en")
      .eq("tenant_id", tenant.id).eq("active", true).order("created_at");
    const knowledge = ((knowledgeRows as any[]) || []) as Knowledge[];

    for (const m of messages) {
      const chatId = String(m?.chat_id ?? m?.from ?? "");
      const text = String(m?.text?.body ?? m?.body ?? "").trim();
      if (chatId.includes("@g.us") || !text) continue;

      // Whapi puede mandar el mismo mensaje dos veces: se procesa solo la primera
      const messageId = String(m?.id ?? "");
      if (messageId) {
        const { error: seenErr } = await supabase.from("whatsapp_inbound_seen").insert({ message_id: messageId });
        if (seenErr?.code === "23505") {
          results.push({ id: messageId, skipped: "mensaje repetido" });
          continue;
        }
      }

      // Mensaje saliente: si lo escribió una persona desde el teléfono (no nuestra API),
      // significa que alguien tomó la conversación y el asistente se calla.
      if (m?.from_me) {
        if (String(m?.source ?? "").toLowerCase() === "api") continue;
        const chatPhone = digits(chatId);
        const { data: existing } = await supabase
          .from("whatsapp_leads").select("phone, history").eq("phone", chatPhone).maybeSingle();
        if (!existing) continue;
        await supabase.from("whatsapp_leads").update({
          handoff: true,
          history: [...(((existing.history as any[]) ?? [])), { role: "assistant", content: text, at: new Date().toISOString() }].slice(-HISTORY_LIMIT),
          updated_at: new Date().toISOString(),
        }).eq("phone", chatPhone);
        results.push({ phone: chatPhone, handoff: "lo tomó una persona" });
        continue;
      }

      const phone = digits(m?.from ?? chatId);
      const name = String(m?.from_name ?? "").trim();
      if (await isKnownContact(supabase, phone)) {
        results.push({ phone, skipped: "contacto del TMS" });
        continue;
      }

      const { data: lead } = await supabase
        .from("whatsapp_leads").select("*").eq("phone", phone).maybeSingle();

      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const repliesToday = lead?.last_reply_date === today ? (lead?.replies_today ?? 0) : 0;
      if (lead?.handoff || repliesToday >= MAX_REPLIES_PER_DAY) {
        await supabase.from("whatsapp_leads").upsert({
          phone, name: name || lead?.name || null,
          history: [...((lead?.history as any[]) ?? []), { role: "user", content: text, at: now }].slice(-HISTORY_LIMIT),
          last_message_at: now,
          updated_at: now,
        }, { onConflict: "phone" });
        results.push({ phone, skipped: lead?.handoff ? "en manos de una persona" : "tope diario" });
        continue;
      }

      const history: HistoryItem[] = [
        ...(((lead?.history as any[]) ?? []).map((h) => ({ role: h.role, content: h.content, at: h.at }))),
        { role: "user", content: text, at: now },
      ].slice(-HISTORY_LIMIT);
      // La conversación que se le pasa a la IA tiene que empezar con un mensaje de la persona
      while (history.length > 1 && history[0].role !== "user") history.shift();
      const system = buildSystem(knowledge, lead, await crmContext(supabase, tenant.id, phone));
      const answer = await askAssistant(system, history, knowledge.length);
      if (!answer) {
        results.push({ phone, skipped: "la IA no respondió" });
        continue;
      }

      // Todas las respuestas son textos fijos, editables desde el TMS
      const faq = answer.action === "faq" ? knowledge[Number(String(answer.faq_id ?? "").replace(/\D/g, "")) - 1] : undefined;
      if (answer.action === "faq" && !faq) answer.action = "human";
      const qualified = answer.action === "qualified";
      const base = ({
        faq: "inbound_ask_vehicle",   // no se usa: la pregunta frecuente tiene su propio texto
        qualified: "inbound_meeting",
        ask_vehicle: "inbound_ask_vehicle",
        not_supported: "inbound_not_supported",
        human: "inbound_human",
      } as Record<Action, string>)[answer.action] ?? "inbound_ask_vehicle";
      const templateKey = answer.language === "en" ? `${base}_en` : base;
      const reply = (faq
        ? (answer.language === "en" && faq.answer_en?.trim() ? faq.answer_en : faq.answer).replaceAll("{nombre}", name || "")
        : await renderMessage(supabase, tenant.id, templateKey, { nombre: name || "" })).trim();
      if (!reply) {
        results.push({ phone, skipped: "sin respuesta que enviar" });
        continue;
      }

      await sendWhapiText(chatId, reply);
      await logMessage(supabase, {
        tenantId: tenant.id, templateKey: qualified ? templateKey : "inbound_reply", recipientType: "lead",
        recipientName: name || phone, groupId: chatId, message: reply,
        reference: faq ? `Entrante · pregunta frecuente: ${faq.question.slice(0, 60)}` : `Entrante · ${answer.action}`,
      }, "sent");

      const newHistory = [...history, { role: "assistant", content: reply, at: new Date().toISOString() }].slice(-HISTORY_LIMIT);
      await supabase.from("whatsapp_leads").upsert({
        phone,
        name: name || lead?.name || null,
        vehicle: answer.vehicle || lead?.vehicle || null,
        service: answer.service || lead?.service || null,
        summary: answer.summary?.trim() || lead?.summary || null,
        last_message_at: now,
        // Con el link ya enviado, o si pide atención personal, sigue una persona
        handoff: qualified || answer.action === "human" || lead?.handoff || false,
        history: newHistory,
        replies_today: repliesToday + 1,
        last_reply_date: today,
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone" });

      // Aviso al grupo de administración: el primer contacto y cuando hace falta una persona
      if (!lead || answer.action === "human" || qualified) {
        const detalle = [
          answer.action === "human"
            ? "⚠️ Pide atención personal"
            : qualified
              ? "✅ Contacto calificado, se le mandó el link para agendar"
              : "🆕 Nuevo contacto por WhatsApp",
          `Nombre: ${name || "—"}`,
          `Teléfono: +${phone}`,
          answer.vehicle ? `Vehículo: ${answer.vehicle}` : "",
          answer.service ? `Interés: ${answer.service}` : "",
          `Dijo: ${text.slice(0, 200)}`,
        ].filter(Boolean).join("\n");
        await notifyAdmin(supabase, tenant, detalle, name || phone);
      }

      results.push({ phone, replied: true, action: answer.action });
    }

    return json({ results });
  } catch (e) {
    console.error("whatsapp-inbound error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

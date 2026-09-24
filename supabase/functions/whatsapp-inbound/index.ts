// deno-lint-ignore-file no-explicit-any
// Respuesta automática a quien escribe al WhatsApp de la empresa.
// Whapi manda cada mensaje entrante a esta función (webhook). Solo contesta a números
// desconocidos en chats 1 a 1: a drivers, investors y dispatchers no les responde nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhapiText } from "../_shared/whapi.ts";
import { logMessage, renderMessage } from "../_shared/messaging.ts";

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

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Dispatch Up, empresa de dispatch de carga en Estados Unidos (Charlotte, NC).
Contestas a personas que escriben por primera vez preguntando por los servicios.

SERVICIOS: dispatch para quien tiene su propio MC#, leasing bajo el MC# de Dispatch Up, trámite de permisos (DOT, MC#, IFTA), curso de dispatcher, TMS y app de tracking, y asesoría.

VEHÍCULOS CON LOS QUE SÍ TRABAJAMOS: ${VEHICLES_OK}.
VEHÍCULOS CON LOS QUE NO TRABAJAMOS: ${VEHICLES_NO}.

NO ESCRIBES MENSAJES. Solo lees lo que dice la persona y eliges una de estas cuatro acciones.
El sistema se encarga de enviar el texto que corresponda.

1. "qualified" — dijo que tiene box truck o hotshot, o pregunta por permisos, DOT, MC#, curso de dispatcher, TMS, leasing o asesoría.
2. "ask_vehicle" — muestra interés en el servicio pero todavía no sabes qué vehículo tiene. Es el caso más común en el primer mensaje.
3. "not_supported" — dijo que tiene un vehículo de los que NO trabajamos.
4. "human" — pregunta precios, quiere negociar, reclama algo, ya es cliente, o el tema se sale de todo lo anterior.

Ante la duda entre "ask_vehicle" y otra, elige "ask_vehicle".
Indica también el idioma en que escribe la persona: "es" o "en".`;

type Action = "qualified" | "ask_vehicle" | "not_supported" | "human";

interface Classification {
  action: Action;
  language: string;
  vehicle: string;
  service: string;
}

async function askAssistant(history: { role: string; content: string }[]): Promise<Classification | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        tools: [{
          name: "responder",
          description: "Responde al mensaje de WhatsApp y clasifica la consulta",
          input_schema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["qualified", "ask_vehicle", "not_supported", "human"], description: "Qué corresponde hacer" },
              language: { type: "string", enum: ["es", "en"], description: "Idioma en que escribe la persona" },
              vehicle: { type: "string", description: "Tipo de vehículo mencionado, o vacío si no lo dijo" },
              service: { type: "string", description: "Servicio que le interesa, o vacío si no está claro" },
            },
            required: ["action", "language", "vehicle", "service"],
          },
        }],
        tool_choice: { type: "tool", name: "responder" },
        messages: history,
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
    if (tenant.wa_inbound_assistant === false) return json({ skipped: "asistente apagado" });

    for (const m of messages) {
      const chatId = String(m?.chat_id ?? m?.from ?? "");
      const text = String(m?.text?.body ?? m?.body ?? "").trim();
      if (chatId.includes("@g.us") || !text) continue;

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
          history: [...(((existing.history as any[]) ?? [])), { role: "assistant", content: text }].slice(-12),
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

      const today = new Date().toISOString().slice(0, 10);
      const repliesToday = lead?.last_reply_date === today ? (lead?.replies_today ?? 0) : 0;
      if (lead?.handoff || repliesToday >= MAX_REPLIES_PER_DAY) {
        await supabase.from("whatsapp_leads").upsert({
          phone, name: name || lead?.name || null,
          history: [...((lead?.history as any[]) ?? []), { role: "user", content: text }].slice(-12),
          updated_at: new Date().toISOString(),
        }, { onConflict: "phone" });
        results.push({ phone, skipped: lead?.handoff ? "en manos de una persona" : "tope diario" });
        continue;
      }

      const history = [...(((lead?.history as any[]) ?? []).map((h) => ({ role: h.role, content: h.content }))), { role: "user", content: text }].slice(-12);
      const answer = await askAssistant(history);
      if (!answer) {
        results.push({ phone, skipped: "la IA no respondió" });
        continue;
      }

      // Todas las respuestas son textos fijos, editables desde el TMS
      const qualified = answer.action === "qualified";
      const base = {
        qualified: "inbound_meeting",
        ask_vehicle: "inbound_ask_vehicle",
        not_supported: "inbound_not_supported",
        human: "inbound_human",
      }[answer.action] ?? "inbound_ask_vehicle";
      const templateKey = answer.language === "en" ? `${base}_en` : base;
      const reply = (await renderMessage(supabase, tenant.id, templateKey, { nombre: name || "" })).trim();
      if (!reply) {
        results.push({ phone, skipped: "sin respuesta que enviar" });
        continue;
      }

      await sendWhapiText(chatId, reply);
      await logMessage(supabase, {
        tenantId: tenant.id, templateKey: qualified ? templateKey : "inbound_reply", recipientType: "lead",
        recipientName: name || phone, groupId: chatId, message: reply, reference: `Entrante · ${answer.action}`,
      }, "sent");

      const newHistory = [...history, { role: "assistant", content: reply }].slice(-12);
      await supabase.from("whatsapp_leads").upsert({
        phone,
        name: name || lead?.name || null,
        vehicle: answer.vehicle || lead?.vehicle || null,
        service: answer.service || lead?.service || null,
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

// deno-lint-ignore-file no-explicit-any
// Agente de IA del número de WhatsApp para prospectos ((980) 457-6720, canal propio de Whapi).
// Whapi manda cada mensaje entrante a esta función (webhook). El agente conversa con quien
// escribe, le pide sus datos de a poco y le agenda la reunión en los horarios libres.
// Solo contesta chats 1 a 1 de quien escribió primero; nunca inicia conversaciones.
// Si alguien del equipo contesta desde el teléfono, el agente se calla con esa persona.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhapiAgentText, sendWhapiText, whapiAgentTyping } from "../_shared/whapi.ts";
import { logMessage } from "../_shared/messaging.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const MODEL = "claude-opus-5-5";
const HISTORY_LIMIT = 30;           // mensajes que se guardan por contacto
const MAX_REPLIES_PER_DAY = 25;     // tope por persona, por si alguien se queda en un ida y vuelta infinito
const DEBOUNCE_MS = 6000;           // espera por si la persona manda varios mensajes seguidos
const MEETING_SLOTS = ["4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM"];   // mismos que la landing (hora del Este)

const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const last10 = (s: string) => digits(s).slice(-10);
const prettyPhone = (s: string) => {
  const d = last10(s);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Postgres devuelve las fechas en otro formato ("+00:00"): se comparan como instantes */
const sameTime = (a: string | null | undefined, b: string) => !!a && new Date(a).getTime() === new Date(b).getTime();

/** Fecha y hora actuales en Charlotte */
function nowET() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    weekday: parts.weekday,
    label: `${parts.weekday} ${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}`,
  };
}

const slotMinutes = (slot: string) => {
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]);
};

const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Horarios libres de los próximos días hábiles (lunes a viernes, como la landing) */
async function availableSlots(supabase: any, days = 6) {
  const now = nowET();
  const dates: string[] = [];
  const cursor = new Date(`${now.date}T12:00:00Z`);
  while (dates.length < days) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const { data } = await supabase
    .from("meeting_requests").select("meeting_date, meeting_time, status")
    .in("meeting_date", dates);
  const taken = new Set(((data as any[]) || [])
    .filter((m) => m.status !== "cancelled")
    .map((m) => `${m.meeting_date} ${m.meeting_time}`));
  return dates.map((date) => {
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const [y, mo, d] = date.split("-");
    const free = MEETING_SLOTS.filter((s) =>
      !taken.has(`${date} ${s}`) && (date !== now.date || slotMinutes(s) > now.minutes + 60));
    return { fecha: date, dia: `${WEEKDAYS_ES[dow]} ${mo}/${d}/${y}`, horas: free };
  }).filter((d) => d.horas.length > 0);
}

const SYSTEM_PROMPT = `Eres el asistente virtual de WhatsApp de Dispatch Up, empresa de dispatch de carga en Estados Unidos con oficina en Charlotte, NC.
Atiendes a personas que escriben a este número, casi siempre por primera vez, interesadas en nuestros servicios.

TU OBJETIVO: conocer a la persona y agendarle una reunión (llamada) con nuestro equipo.

SERVICIOS: dispatch para quien tiene su propio MC#; leasing para manejar bajo el MC# de nuestra empresa; trámite de permisos (DOT, MC#, IFTA); curso de dispatcher; TMS y app de tracking; asesoría para empezar en el negocio.
VEHÍCULOS CON LOS QUE TRABAJAMOS: box truck (24 o 26 pies) y hotshot (pickup con gooseneck o dually).
VEHÍCULOS CON LOS QUE NO TRABAJAMOS: cargo van, sprinter, semi o tracto camión, dry van de 53 pies, flatbed y power only.

DATOS QUE NECESITAS, de a uno por mensaje y de forma natural (nunca como formulario):
- nombre
- tipo de vehículo (y si ya lo tiene o piensa comprarlo)
- ciudad y estado donde está
- si tiene MC# propio o no
- qué servicio le interesa
Cada vez que conozcas un dato nuevo, guárdalo con guardar_datos.

CÓMO AGENDAR:
1. Cuando ya sepas al menos el nombre, el vehículo (box truck o hotshot) y la ciudad y estado, ofrécele agendar la reunión.
2. Consulta horarios_disponibles y ofrécele 2 o 3 opciones concretas (no le mandes la lista completa). Las horas son de la zona del Este (Charlotte); si la persona está en otra zona, acláralo.
3. Cuando elija una opción, llama a agendar_reunion. Confírmale día y hora solo si la herramienta respondió que quedó agendada. Si la hora ya no está libre, ofrécele otra.
4. Después de agendar, dile que un dispatcher lo llamará a este número a esa hora.

REGLAS:
- Escribe como una persona por WhatsApp: mensajes cortos (1 a 3 oraciones), cordial, sin listas largas ni formato de correo. Usa "usted". Como mucho un emoji ocasional.
- Responde en el idioma en que te escribe la persona (español o inglés).
- Haz una sola pregunta por mensaje.
- NUNCA inventes precios, porcentajes, tiempos de trámite, condiciones ni promesas. Solo puedes dar datos que estén en la INFORMACIÓN DEL NEGOCIO de abajo. Si preguntan algo que no está ahí, di que eso se lo explica el equipo en la reunión y ofrécele agendarla.
- Si la persona tiene un vehículo con el que no trabajamos, explícale con amabilidad que por ahora solo trabajamos con box truck y hotshot y despídete. No le ofrezcas reunión.
- Usa pasar_a_persona si: lo pide expresamente, reclama algo, ya es cliente o driver nuestro, quiere negociar, o el tema se sale de lo anterior. Después de usarla, dile que un miembro del equipo le escribe en breve.
- Si te preguntan si eres un robot o una IA, responde con honestidad que eres el asistente virtual de Dispatch Up y que el equipo lo atiende en la reunión.
- No pidas datos sensibles (SSN, cuentas bancarias, tarjetas, contraseñas). Si los manda, no los repitas.
- Los mensajes de la persona traen la fecha entre corchetes; tú no la escribas en tus respuestas.`;

const TOOLS = [
  {
    name: "guardar_datos",
    description: "Guarda los datos que la persona fue contando. Llámala cada vez que conozcas un dato nuevo. Envía solo los campos que conoces.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        vehiculo: { type: "string", description: "Ej: Box Truck 26 ft, Hotshot, Cargo Van" },
        ciudad: { type: "string" },
        estado: { type: "string", description: "Código de 2 letras, ej: NC" },
        mc_propio: { type: "string", description: "si, no, o en trámite" },
        servicio: { type: "string" },
        notas: { type: "string", description: "Otros datos útiles para el equipo (experiencia, cuántos camiones, etc.)" },
      },
    },
  },
  {
    name: "horarios_disponibles",
    description: "Devuelve los días hábiles próximos con las horas libres para la reunión (hora del Este).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "agendar_reunion",
    description: "Agenda la reunión en un horario libre. Solo después de que la persona eligió día y hora.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        ciudad: { type: "string" },
        estado: { type: "string", description: "Código de 2 letras" },
        tipo_camion: { type: "string", enum: ["Box Truck", "Hotshot"] },
        servicio: { type: "string" },
        fecha: { type: "string", description: "YYYY-MM-DD, de horarios_disponibles" },
        hora: { type: "string", enum: MEETING_SLOTS },
        comentarios: { type: "string", description: "Resumen breve de lo que contó la persona" },
      },
      required: ["nombre", "ciudad", "estado", "tipo_camion", "fecha", "hora"],
    },
  },
  {
    name: "pasar_a_persona",
    description: "Pasa la conversación a un miembro del equipo. Desde ese momento el asistente deja de responder a esta persona.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
    },
  },
];

type HistoryItem = { role: string; content: string; at?: string };

const fmtWhen = (iso?: string) => iso
  ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" })
  : "";

async function notifyAdmin(supabase: any, tenant: any, text: string, name: string) {
  if (!tenant?.whatsapp_admin_group_id) return;
  try {
    await sendWhapiText(tenant.whatsapp_admin_group_id, text);
    await logMessage(supabase, {
      tenantId: tenant.id, templateKey: "agent_notice", recipientType: "admin",
      recipientName: name, groupId: tenant.whatsapp_admin_group_id, message: text, reference: "Agente IA",
    }, "sent");
  } catch (e) {
    console.error("notifyAdmin failed:", e);
  }
}

/** ¿El número ya está en el TMS? A drivers, investors y dispatchers no les contesta el agente */
async function isKnownContact(supabase: any, phone: string): Promise<boolean> {
  const tail = last10(phone);
  if (tail.length < 10) return false;
  for (const table of ["drivers", "investors", "dispatchers"]) {
    const { data } = await supabase.from(table).select("phone").not("phone", "is", null);
    if (((data as any[]) || []).some((r) => last10(r.phone) === tail)) return true;
  }
  return false;
}

/** Lo que trae el mensaje, en texto. Audios, fotos, etc. se describen para que el agente lo sepa. */
function messageText(m: any): string {
  const text = String(m?.text?.body ?? m?.body ?? "").trim();
  if (text) return text;
  const caption = String(m?.image?.caption ?? m?.video?.caption ?? m?.document?.caption ?? "").trim();
  const kind: Record<string, string> = {
    voice: "un audio", audio: "un audio", image: "una foto", video: "un video",
    document: "un documento", sticker: "un sticker", location: "su ubicación", contact: "un contacto",
  };
  const what = kind[String(m?.type ?? "")];
  if (!what) return "";
  return `(La persona envió ${what}, que no puedes ver ni escuchar${caption ? `, con el texto: "${caption}"` : ""}. Si importa, pídele que lo escriba.)`;
}

interface Ctx {
  supabase: any;
  tenant: any;
  phone: string;
  chatId: string;
  name: string;
  lead: any;
  changes: Record<string, unknown>;
  profile: Record<string, string>;
  handoff?: string;
  booked?: string;
  dryRun?: boolean;          // prueba: no agenda de verdad
  trace?: string[];
}

async function runTool(ctx: Ctx, name: string, input: any): Promise<string> {
  if (name === "guardar_datos") {
    for (const [k, v] of Object.entries(input ?? {})) {
      if (typeof v === "string" && v.trim()) ctx.profile[k] = v.trim();
    }
    return "Guardado.";
  }

  if (name === "horarios_disponibles") {
    const slots = await availableSlots(ctx.supabase);
    return slots.length > 0
      ? JSON.stringify(slots)
      : "No hay horarios libres en los próximos días. Usa pasar_a_persona para que el equipo coordine la reunión.";
  }

  if (name === "agendar_reunion") {
    if (ctx.lead?.meeting_booked_at || ctx.booked) {
      return "Esta persona ya tiene una reunión agendada. Si quiere cambiarla, usa pasar_a_persona.";
    }
    const slots = await availableSlots(ctx.supabase);
    const day = slots.find((d) => d.fecha === input?.fecha);
    if (!day || !day.horas.includes(input?.hora)) {
      return `Ese horario no está libre. Horarios libres: ${JSON.stringify(slots)}`;
    }
    if (ctx.dryRun) {
      ctx.booked = `${day.dia} ${input.hora}`;
      return `Reunión agendada: ${day.dia} a las ${input.hora} (hora del Este).`;
    }
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-meeting-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      body: JSON.stringify({
        driver_name: String(input.nombre ?? ctx.name).slice(0, 100),
        phone: prettyPhone(ctx.phone),
        city: String(input.ciudad ?? "").slice(0, 100),
        state: String(input.estado ?? "").toUpperCase().slice(0, 2),
        truck_type: input.tipo_camion,
        meeting_date: input.fecha,
        meeting_time: input.hora,
        service_interest: input.servicio || null,
        comments: `Agendada por el agente de WhatsApp. ${String(input.comentarios ?? "")}`.trim().slice(0, 500),
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (out?.slot_taken) return `Esa hora la acaba de tomar otra persona. Ofrécele otra de: ${JSON.stringify(await availableSlots(ctx.supabase))}`;
    if (!res.ok || out?.error) return `No se pudo agendar (${out?.error ?? res.status}). Usa pasar_a_persona.`;
    ctx.booked = `${day.dia} ${input.hora}`;
    ctx.changes.meeting_booked_at = new Date().toISOString();
    return `Reunión agendada: ${day.dia} a las ${input.hora} (hora del Este).`;
  }

  if (name === "pasar_a_persona") {
    ctx.handoff = String(input?.motivo ?? "Pidió atención personal");
    ctx.changes.handoff = true;
    return "Listo, el equipo fue avisado.";
  }

  return `Herramienta desconocida: ${name}`;
}

/** Conversación con Claude: puede usar herramientas varias veces antes de dar la respuesta final */
async function converse(ctx: Ctx, system: string, history: HistoryItem[]): Promise<string | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const messages: any[] = history.map((h) => ({
    role: h.role,
    content: h.role === "user" && h.at ? `[${fmtWhen(h.at)}] ${h.content}` : h.content,
  }));

  for (let round = 0; round < 6; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "low" },
        fallbacks: "default",
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    if (data.stop_reason === "refusal") return null;

    const toolUses = (data.content ?? []).filter((c: any) => c.type === "tool_use");
    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
      // Por si copia el formato de fecha de los mensajes de la persona
      return text.replace(/^\[[^\]]{4,30}\]\s*/, "") || null;
    }

    // Se devuelve el contenido tal cual (incluye los bloques de razonamiento) y todos los resultados juntos
    messages.push({ role: "assistant", content: data.content });
    const results = [];
    for (const t of toolUses) {
      let out: string;
      try {
        out = await runTool(ctx, t.name, t.input);
      } catch (e) {
        out = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
      ctx.trace?.push(`${t.name}(${JSON.stringify(t.input)}) → ${out.slice(0, 200)}`);
      results.push({ type: "tool_result", tool_use_id: t.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return null;
}

/** Prompt base + preguntas frecuentes + lo que ya se sabe de la persona */
async function buildSystem(supabase: any, tenant: any, phone: string, name: string, profile: Record<string, string>, booked: boolean) {
  const { data: knowledge } = await supabase
    .from("whatsapp_knowledge").select("question, answer")
    .eq("tenant_id", tenant.id).eq("active", true).order("created_at");
  const facts = (knowledge as any[]) ?? [];
  return [
    SYSTEM_PROMPT,
    facts.length > 0
      ? "INFORMACIÓN DEL NEGOCIO (lo único que puedes afirmar sobre precios y condiciones):\n" +
        facts.map((k) => `- ${k.question}: ${k.answer}`).join("\n")
      : "INFORMACIÓN DEL NEGOCIO: no hay datos de precios ni condiciones cargados; esos temas se ven en la reunión.",
    `AHORA: ${nowET().label} (hora del Este).`,
    `CONTACTO: WhatsApp ${prettyPhone(phone)}${name ? `, nombre en WhatsApp: ${name}` : ""}.`,
    Object.keys(profile).length > 0 ? `DATOS YA GUARDADOS: ${JSON.stringify(profile)}` : "",
    booked ? "YA TIENE REUNIÓN AGENDADA por este chat." : "",
  ].filter(Boolean).join("\n\n");
}

/**
 * Prueba sin enviar nada: recibe una conversación inventada y devuelve lo que contestaría el agente.
 * No guarda en la base de datos ni agenda de verdad.
 */
async function dryRun(supabase: any, tenant: any, body: any) {
  const profile: Record<string, string> = { ...(body.profile ?? {}) };
  const history: HistoryItem[] = (body.history ?? []).map((h: any) => ({ role: h.role, content: h.content, at: new Date().toISOString() }));
  const phone = digits(body.phone ?? "15555550100");
  const ctx: Ctx = { supabase, tenant, phone, chatId: `${phone}@s.whatsapp.net`, name: body.name ?? "", lead: {}, changes: {}, profile, dryRun: true, trace: [] };
  const system = await buildSystem(supabase, tenant, phone, ctx.name, profile, false);
  const reply = await converse(ctx, system, history);
  return { reply, tools: ctx.trace, profile, handoff: ctx.handoff ?? null, booked: ctx.booked ?? null };
}

/** Procesa un mensaje entrante. Corre en segundo plano: Whapi ya recibió su respuesta. */
async function handleMessage(supabase: any, tenant: any, m: any) {
  const chatId = String(m?.chat_id ?? m?.from ?? "");
  if (!chatId || chatId.includes("@g.us") || chatId.includes("@newsletter") || chatId.includes("@broadcast")) return;
  const text = messageText(m);
  if (!text) return;

  // Whapi puede mandar el mismo mensaje dos veces: se procesa solo la primera
  const messageId = String(m?.id ?? "");
  if (messageId) {
    const { error } = await supabase.from("whatsapp_inbound_seen").insert({ message_id: `agent:${messageId}` });
    if (error?.code === "23505") return;
  }

  const now = new Date().toISOString();

  // Mensaje saliente escrito por una persona desde el teléfono: alguien tomó la conversación
  if (m?.from_me) {
    if (String(m?.source ?? "").toLowerCase() === "api") return;
    const chatPhone = digits(chatId);
    const { data: existing } = await supabase.from("whatsapp_leads").select("history").eq("phone", chatPhone).maybeSingle();
    if (!existing) return;
    await supabase.from("whatsapp_leads").update({
      handoff: true,
      history: [...((existing.history as any[]) ?? []), { role: "assistant", content: text, at: now }].slice(-HISTORY_LIMIT),
      updated_at: now,
    }).eq("phone", chatPhone);
    return;
  }

  const phone = digits(m?.from ?? chatId);
  const name = String(m?.from_name ?? "").trim();
  if (await isKnownContact(supabase, phone)) return;

  // Se guarda el mensaje enseguida, así la memoria lo tiene aunque luego no se conteste
  const { data: before } = await supabase.from("whatsapp_leads").select("*").eq("phone", phone).maybeSingle();
  const isNew = !before;
  await supabase.from("whatsapp_leads").upsert({
    phone,
    name: before?.name || name || null,
    source: before?.source || "agent",
    history: [...((before?.history as any[]) ?? []), { role: "user", content: text, at: now }].slice(-HISTORY_LIMIT),
    last_message_at: now,
    updated_at: now,
  }, { onConflict: "phone" });

  if (isNew) {
    await notifyAdmin(supabase, tenant, [
      "🆕 Nuevo contacto en el WhatsApp del agente IA",
      `Nombre: ${name || "—"}`,
      `Teléfono: ${prettyPhone(phone)}`,
      `Dijo: ${text.slice(0, 200)}`,
    ].join("\n"), name || phone);
  }
  if (before?.handoff) return;

  // Si manda varios mensajes seguidos, se contesta una sola vez, al último
  await sleep(DEBOUNCE_MS);
  const { data: lead } = await supabase.from("whatsapp_leads").select("*").eq("phone", phone).maybeSingle();
  if (!lead || lead.handoff || !sameTime(lead.last_message_at, now)) return;

  const today = now.slice(0, 10);
  const repliesToday = lead.last_reply_date === today ? (lead.replies_today ?? 0) : 0;
  if (repliesToday >= MAX_REPLIES_PER_DAY) return;

  const history: HistoryItem[] = ((lead.history as any[]) ?? []).map((h) => ({ role: h.role, content: h.content, at: h.at }));
  while (history.length > 1 && history[0].role !== "user") history.shift();

  const profile: Record<string, string> = { ...((lead.profile as any) ?? {}) };
  const system = await buildSystem(supabase, tenant, phone, name, profile, !!lead.meeting_booked_at);

  const ctx: Ctx = { supabase, tenant, phone, chatId, name, lead, changes: {}, profile };
  let reply: string | null = null;
  try {
    reply = await converse(ctx, system, history);
  } catch (e) {
    console.error("converse failed:", e);
  }

  // Si mientras pensaba llegó otro mensaje, ese se contesta en su turno
  const { data: latest } = await supabase.from("whatsapp_leads").select("last_message_at, handoff, history").eq("phone", phone).maybeSingle();
  if (!sameTime(latest?.last_message_at, now) || latest?.handoff) return;

  if (reply) {
    await whapiAgentTyping(chatId, Math.min(8, 2 + reply.length / 60));
    await sleep(Math.min(8000, 1500 + reply.length * 25));
    try {
      await sendWhapiAgentText(chatId, reply);
      await logMessage(supabase, {
        tenantId: tenant.id, templateKey: "agent_reply", recipientType: "lead",
        recipientName: name || phone, groupId: chatId, message: reply, reference: "Agente IA",
      }, "sent");
    } catch (e) {
      console.error("send failed:", e);
      await logMessage(supabase, {
        tenantId: tenant.id, templateKey: "agent_reply", recipientType: "lead",
        recipientName: name || phone, groupId: chatId, message: reply, reference: "Agente IA",
      }, "failed", e instanceof Error ? e.message : String(e));
      reply = null;
    }
  }

  const summary = [
    profile.nombre ? `Nombre: ${profile.nombre}` : "",
    profile.vehiculo ? `Vehículo: ${profile.vehiculo}` : "",
    profile.ciudad || profile.estado ? `Ubicación: ${[profile.ciudad, profile.estado].filter(Boolean).join(", ")}` : "",
    profile.mc_propio ? `MC propio: ${profile.mc_propio}` : "",
    profile.servicio ? `Interés: ${profile.servicio}` : "",
    profile.notas ? `Notas: ${profile.notas}` : "",
    ctx.booked || lead.meeting_booked_at ? `Reunión agendada${ctx.booked ? `: ${ctx.booked}` : ""}` : "",
  ].filter(Boolean).join(" · ");

  await supabase.from("whatsapp_leads").update({
    ...ctx.changes,
    name: profile.nombre || lead.name,
    vehicle: profile.vehiculo || lead.vehicle,
    service: profile.servicio || lead.service,
    profile,
    summary: summary || lead.summary,
    history: reply
      ? [...((latest?.history as any[]) ?? []), { role: "assistant", content: reply, at: new Date().toISOString() }].slice(-HISTORY_LIMIT)
      : latest?.history,
    replies_today: repliesToday + (reply ? 1 : 0),
    last_reply_date: today,
    updated_at: new Date().toISOString(),
  }).eq("phone", phone);

  if (ctx.handoff || (!reply && !ctx.booked)) {
    await notifyAdmin(supabase, tenant, [
      ctx.handoff ? "⚠️ El agente IA pasó una conversación a una persona" : "⚠️ El agente IA no pudo responder",
      `Nombre: ${profile.nombre || name || "—"}`,
      `Teléfono: ${prettyPhone(phone)}`,
      ctx.handoff ? `Motivo: ${ctx.handoff}` : "",
      summary ? `Datos: ${summary}` : "",
      `Último mensaje: ${text.slice(0, 200)}`,
      "Contéstale desde el teléfono del agente: al escribirle tú, el agente deja de responderle.",
    ].filter(Boolean).join("\n"), name || phone);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as any[];
  if (messages.length === 0 && !body?.dry_run) return json({ ok: true });

  const cols = "id, whatsapp_admin_group_id, wa_ai_agent";
  let { data: tenant } = await supabase.from("tenants").select(cols).not("whatsapp_admin_group_id", "is", null).limit(1).maybeSingle();
  if (!tenant) ({ data: tenant } = await supabase.from("tenants").select(cols).limit(1).maybeSingle());
  if (!tenant) return json({ error: "No hay tenant configurado" }, 500);

  if (body?.dry_run) {
    try {
      return json(await dryRun(supabase, tenant, body));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }
  if (tenant.wa_ai_agent === false) return json({ ok: true, skipped: "agente apagado" });

  // Se responde a Whapi enseguida y la conversación sigue en segundo plano
  const work = Promise.all(messages.map((m) =>
    handleMessage(supabase, tenant, m).catch((e) => console.error("whatsapp-agent error:", e))));
  // @ts-ignore EdgeRuntime existe en Supabase Edge Functions
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;
  return json({ ok: true, received: messages.length });
});

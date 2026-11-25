// deno-lint-ignore-file no-explicit-any
// Agenda tipo Calendly (página pública /agendar y su enlace para reagendar/cancelar).
//  • availability: horarios libres (configuración del CRM − reuniones ya agendadas − ocupado en Google Calendar)
//  • book / get / cancel / reschedule: sin sesión; reagendar y cancelar van con el manage_token del enlace
//  • reminders (cron, x-cron-secret): recordatorios por email al prospecto 24 h y 1 h antes
// Las invitaciones .ics salen desde el Gmail de la app (58 Logistics) al prospecto y a tu calendario.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// nodemailer y no denomailer: denomailer rompe los asuntos largos con acentos (y con ellos todo el email)
import nodemailer from "npm:nodemailer@6.9.16";
import ICAL from "npm:ical.js@1.5.0";
import { isEnabled, renderMessage, sendTextLogged } from "../_shared/messaging.ts";
import { appGmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TZ = "America/New_York";
const SITE = "https://www.dispatch-up.com";

// ─── Fechas en hora del Este ───

/** Minutos que la hora del Este va adelante de UTC en ese instante (negativo: -240 / -300) */
function etOffsetMin(ts: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  );
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ts / 60000) * 60000) / 60000;
}

/** "2026-11-20" + minutos del día en hora del Este → instante UTC */
function etToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let ts = guess - etOffsetMin(guess) * 60000;
  ts = guess - etOffsetMin(ts) * 60000; // cambio de horario
  return new Date(ts);
}

const etDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** 990 → "4:30 PM" (mismo formato que ya usan los recordatorios y el CRM) */
function label(min: number): string {
  const h = Math.floor(min / 60), mm = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function parseLabel(s: string): number | null {
  const m = String(s ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}
const timeToMin = (t: string) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };

/** "Lunes, 16 de Noviembre de 2026" (día y mes con mayúscula) */
function prettyDate(date: string, lang: string): string {
  const txt = new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-US" : "es-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  return txt.replace(/\p{L}{3,}/gu, (w) => w[0].toUpperCase() + w.slice(1));
}

/** 19802988786 → "(980) 298-8786" */
function prettyPhone(phone: string): string {
  const d = String(phone ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(phone ?? "");
}

// ─── Configuración ───

async function loadSettings(supabase: any) {
  const { data: tenant } = await supabase
    .from("tenants").select("id, whatsapp_meetings_group_id")
    .not("whatsapp_meetings_group_id", "is", null).limit(1).maybeSingle();
  const { data: s } = await supabase.from("booking_settings").select("*").eq("tenant_id", tenant?.id).maybeSingle();
  return {
    tenantId: tenant?.id ?? null,
    groupId: tenant?.whatsapp_meetings_group_id ?? null,
    weekdays: (s?.weekdays as number[]) ?? [1, 2, 3, 4, 5],
    start: timeToMin(s?.day_start ?? "16:30"),
    end: timeToMin(s?.day_end ?? "18:30"),
    duration: s?.duration_min ?? 30,
    buffer: s?.buffer_min ?? 0,
    minNotice: s?.min_notice_hours ?? 2,
    maxDays: s?.max_days_ahead ?? 30,
    calendarEmail: (s?.calendar_email ?? "").trim() || null,
    title: s?.meeting_title ?? "Reunión con 58 Dispatch Service",
  };
}
type Settings = Awaited<ReturnType<typeof loadSettings>>;

// ─── Google Calendar (dirección secreta iCal): horas ocupadas ───

/** Estado de la última lectura de Google Calendar (se muestra en el CRM) */
let calendarStatus: { state: "off" | "ok" | "error"; events?: number; error?: string } = { state: "off" };

async function googleBusy(from: Date, to: Date): Promise<{ start: number; end: number }[]> {
  const url = Deno.env.get("GCAL_ICS_URL");
  if (!url) { calendarStatus = { state: "off" }; return []; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const comp = new ICAL.Component(ICAL.parse(await res.text()));
    for (const tz of comp.getAllSubcomponents("vtimezone")) {
      try { ICAL.TimezoneService.register(new ICAL.Timezone(tz)); } catch { /* ya registrada */ }
    }
    const busy: { start: number; end: number }[] = [];
    const lo = from.getTime(), hi = to.getTime();
    for (const ve of comp.getAllSubcomponents("vevent")) {
      // Eventos marcados como "Disponible" (y los de todo el día, que Google exporta así) no bloquean
      if (String(ve.getFirstPropertyValue("transp") ?? "").toUpperCase() === "TRANSPARENT") continue;
      if (String(ve.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
      const ev = new ICAL.Event(ve);
      if (!ev.startDate) continue;
      if (ev.startDate.isDate) continue; // todo el día
      if (ev.isRecurring()) {
        const it = ev.iterator();
        let next, guard = 0;
        while ((next = it.next()) && guard++ < 2000) {
          const occ = ev.getOccurrenceDetails(next);
          const s = occ.startDate.toJSDate().getTime(), e = occ.endDate.toJSDate().getTime();
          if (s > hi) break;
          if (e > lo) busy.push({ start: s, end: e });
        }
      } else {
        const s = ev.startDate.toJSDate().getTime();
        const e = (ev.endDate ?? ev.startDate).toJSDate().getTime();
        if (e > lo && s < hi) busy.push({ start: s, end: Math.max(e, s + 60000) });
      }
    }
    calendarStatus = { state: "ok", events: busy.length };
    return busy;
  } catch (e) {
    console.error("googleBusy:", errMsg(e));
    calendarStatus = { state: "error", error: errMsg(e) };
    return [];
  }
}

// ─── Disponibilidad ───

async function availability(supabase: any, cfg: Settings, excludeId?: string) {
  const now = Date.now();
  const today = etDate(new Date());
  const lastDay = addDays(today, cfg.maxDays);
  const earliest = now + cfg.minNotice * 3600000;

  const { data: booked } = await supabase
    .from("meeting_requests").select("id, meeting_date, meeting_time, duration_min")
    .gte("meeting_date", today).lte("meeting_date", lastDay).neq("status", "cancelled");
  const taken = ((booked as any[]) ?? [])
    .filter((b) => b.id !== excludeId)
    .flatMap((b) => {
      const m = parseLabel(b.meeting_time);
      if (m === null) return [];
      const s = etToUtc(b.meeting_date, m).getTime();
      return [{ start: s, end: s + (b.duration_min ?? cfg.duration) * 60000 }];
    });
  const busy = [...taken, ...(await googleBusy(new Date(now), etToUtc(addDays(lastDay, 1), 0)))];

  const days: Record<string, string[]> = {};
  for (let date = today; date <= lastDay; date = addDays(date, 1)) {
    if (!cfg.weekdays.includes(weekday(date))) continue;
    const slots: string[] = [];
    for (let m = cfg.start; m + cfg.duration <= cfg.end; m += cfg.duration + cfg.buffer) {
      const s = etToUtc(date, m).getTime();
      const e = s + cfg.duration * 60000;
      if (s < earliest) continue;
      // El colchón entre reuniones se respeta también contra lo ocupado
      const pad = cfg.buffer * 60000;
      if (busy.some((b) => b.start < e + pad && b.end > s - pad)) continue;
      slots.push(label(m));
    }
    if (slots.length) days[date] = slots;
  }
  return days;
}

// ─── Invitación de calendario (.ics) ───

const icsEsc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Líneas de máximo 75 bytes (RFC 5545) */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function buildIcs(m: any, cfg: Settings, method: "REQUEST" | "CANCEL", organizer: string): string {
  const start = etToUtc(m.meeting_date, parseLabel(m.meeting_time)!);
  const end = new Date(start.getTime() + (m.duration_min ?? cfg.duration) * 60000);
  const manage = `${SITE}/agendar/${m.manage_token}`;
  const desc = [
    `Te llamaremos al ${m.phone}.`,
    `Nombre: ${m.driver_name}`,
    m.truck_type ? `Camión: ${m.truck_type}` : "",
    m.service_interest ? `Servicio: ${m.service_interest}` : "",
    m.comments ? `Comentarios: ${m.comments}` : "",
    "",
    `Reagendar o cancelar: ${manage}`,
  ].filter((x) => x !== "").join("\n");
  const attendees = [
    m.email ? `ATTENDEE;CN=${icsEsc(m.driver_name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${m.email}` : "",
    cfg.calendarEmail ? `ATTENDEE;CN=58 Dispatch Service;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${cfg.calendarEmail}` : "",
  ].filter(Boolean);
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//58 Dispatch Service//Agenda//ES",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:meeting-${m.id}@dispatch-up.com`,
    `SEQUENCE:${m.invite_sequence ?? 0}`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsEsc(`${cfg.title} – ${m.driver_name}`)}`,
    `DESCRIPTION:${icsEsc(desc)}`,
    `LOCATION:${icsEsc(`Llamada telefónica al ${m.phone}`)}`,
    `URL:${manage}`,
    `ORGANIZER;CN=58 Dispatch Service:mailto:${organizer}`,
    ...attendees,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(method === "REQUEST"
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio", "TRIGGER:-PT15M", "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ─── Emails ───

function emailHtml(title: string, intro: string, m: any, lang: string, extra = ""): string {
  const en = lang === "en";
  const manage = `${SITE}/agendar/${m.manage_token}`;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 12px;color:#6b7280;width:38%">${k}</td><td style="padding:8px 12px;color:#111827;font-weight:600">${v}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px">
    <div style="background:#1e3a5f;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0"><h2 style="margin:0;font-size:20px">${title}</h2></div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:20px">
      ${intro ? `<p style="margin:0 0 14px;color:#111827">${intro}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px">
        ${row(en ? "NAME" : "NOMBRE", m.driver_name)}
        ${row(en ? "DATE" : "FECHA", prettyDate(m.meeting_date, lang))}
        ${row(en ? "TIME" : "HORA", `${m.meeting_time} ${en ? "Eastern Time (ET)" : "hora del Este (ET)"}`)}
        ${row(en ? "PHONE" : "TELÉFONO", prettyPhone(m.phone))}
        ${row(en ? "VEHICLE TYPE" : "TIPO DE VEHÍCULO", m.truck_type || "—")}
        ${row(en ? "SERVICE TYPE" : "TIPO DE SERVICIO", m.service_interest || "—")}
      </table>
      ${extra}
      <p style="margin:18px 0 0"><a href="${manage}" style="display:inline-block;background:#266aad;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">${en ? "Reschedule or cancel" : "Reagendar o cancelar"}</a></p>
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px">58 Dispatch Service · 58 Logistics LLC</p>
    </div></div>`;
}

async function sendMail(to: string[], subject: string, html: string, ics?: { body: string; method: string }) {
  const { user, pass } = appGmail();
  if (!user || !pass) throw new Error("Falta el Gmail de la app");
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  try {
    await transport.sendMail({
      from: { name: "58 Dispatch Service", address: user },
      to,
      subject,
      html,
      // Invitación de calendario: Gmail/Outlook la muestran con Sí / No / Quizás y la agregan al calendario
      ...(ics ? { icalEvent: { method: ics.method, filename: "invite.ics", content: ics.body } } : {}),
    });
  } finally {
    transport.close();
  }
}

/** Invitación (nueva, cambiada o cancelada) al prospecto y a tu calendario */
async function sendInvite(m: any, cfg: Settings, kind: "new" | "update" | "cancel", lang: string) {
  const organizer = appGmail().user;
  const en = lang === "en";
  const ics = buildIcs(m, cfg, kind === "cancel" ? "CANCEL" : "REQUEST", organizer);
  const subj = kind === "cancel"
    ? (en ? "Meeting Cancelled with 58 Dispatch Service" : "Reunión Cancelada con 58 Dispatch Service")
    : kind === "update"
    ? (en ? "Meeting Rescheduled with 58 Dispatch Service" : "Reunión Reagendada con 58 Dispatch Service")
    : (en ? "Meeting Confirmed with 58 Dispatch Service" : "Reunión Confirmada con 58 Dispatch Service");
  const title = kind === "cancel" ? (en ? "Call cancelled" : "Llamada cancelada")
    : kind === "update" ? (en ? "New time confirmed" : "Nuevo horario confirmado")
    : (en ? "Your call is booked" : "Tu llamada está agendada");
  const intro = kind === "cancel"
    ? (en ? `Hi ${m.driver_name}, this call was cancelled. You can book a new time whenever you want at ${SITE}/agendar.` : `Hola ${m.driver_name}, esta llamada quedó cancelada. Puedes agendar otra cuando quieras en ${SITE}/agendar.`)
    : (en ? `Hi ${m.driver_name}, we'll call you at the time below.` : `Hola ${m.driver_name}, te llamaremos a la hora indicada.`);

  if (m.email) {
    await sendMail([m.email], `${subj} – ${m.meeting_time} ET`, emailHtml(title, intro, m, lang), { body: ics, method: kind === "cancel" ? "CANCEL" : "REQUEST" });
  }
  // Tu calendario: con el script de Google, el evento se crea/mueve/borra directo en Google Calendar
  // (Gmail no agrega al calendario una invitación que la cuenta se manda a sí misma)
  if (Deno.env.get("GCAL_SCRIPT_URL")) {
    // Aviso por email a la cuenta de 58 (sin invitación: el evento ya lo crea el script)
    if (cfg.calendarEmail && cfg.calendarEmail.toLowerCase() !== (m.email ?? "").toLowerCase()) {
      const what = kind === "cancel" ? "Reunión cancelada" : kind === "update" ? "Reunión reagendada" : "Nueva reunión agendada";
      await sendMail([cfg.calendarEmail], `${what} – ${m.driver_name} – ${prettyDate(m.meeting_date, "es")} ${m.meeting_time} ET`,
        emailHtml(what, "", m, "es"));
    }
    return;
  }
  if (cfg.calendarEmail && cfg.calendarEmail.toLowerCase() !== (m.email ?? "").toLowerCase()) {
    await sendMail([cfg.calendarEmail], `${subj} – ${m.driver_name}`, emailHtml(title, "", m, "es"),
      { body: ics, method: kind === "cancel" ? "CANCEL" : "REQUEST" });
  }
}

// ─── Google Calendar: evento directo con el script de Google (Apps Script) ───

async function syncGoogleEvent(supabase: any, m: any, cfg: Settings) {
  const url = Deno.env.get("GCAL_SCRIPT_URL"), secret = Deno.env.get("GCAL_SCRIPT_SECRET");
  if (!url || !secret) return;
  const cancelled = m.status === "cancelled";
  if (cancelled && !m.gcal_event_id) return;
  const start = etToUtc(m.meeting_date, parseLabel(m.meeting_time)!);
  const end = new Date(start.getTime() + (m.duration_min ?? cfg.duration) * 60000);
  const description = [
    `NOMBRE: ${m.driver_name}`,
    `TELÉFONO: ${prettyPhone(m.phone)}`,
    m.email ? `EMAIL: ${m.email}` : "",
    m.city || m.state ? `CIUDAD: ${[m.city, m.state].filter(Boolean).join(", ")}` : "",
    `TIPO DE VEHÍCULO: ${m.truck_type || "—"}`,
    `TIPO DE SERVICIO: ${m.service_interest || "—"}`,
    m.comments ? `COMENTARIOS: ${m.comments}` : "",
  ].filter(Boolean).join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(cancelled
      ? { secret, action: "delete", eventId: m.gcal_event_id }
      : {
        secret, action: "upsert", eventId: m.gcal_event_id ?? null,
        title: `${cfg.title} – ${m.driver_name}`, start: start.toISOString(), end: end.toISOString(),
        description, location: `Llamada al ${prettyPhone(m.phone)}`,
      }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.error) throw new Error(`Google Calendar: ${out.error ?? `HTTP ${res.status}`}`);
  if (!cancelled && out.eventId && out.eventId !== m.gcal_event_id) {
    await supabase.from("meeting_requests").update({ gcal_event_id: out.eventId }).eq("id", m.id);
  }
}

// ─── Aviso al grupo de reuniones (WhatsApp, solo grupo) ───

async function notifyGroup(supabase: any, cfg: Settings, m: any, kind: "new" | "update" | "cancel") {
  if (!cfg.groupId || !cfg.tenantId || !(await isEnabled(supabase, cfg.tenantId, "wa_meeting_booked"))) return;
  const [y, mo, d] = String(m.meeting_date).split("-");
  const fecha = `${mo}/${d}/${y}`;
  const message = kind === "new"
    ? await renderMessage(supabase, cfg.tenantId, "meeting_booked", {
      nombre: m.driver_name, telefono: m.phone, camion: m.truck_type || "—",
      ciudad: [m.city, m.state].filter(Boolean).join(", ") || "—",
      hora: m.meeting_time, fecha, servicio: m.service_interest || "—", comentarios: m.comments || "—",
    })
    : kind === "update"
    ? `🔁 ${m.driver_name} (${m.phone}) cambió su reunión para el ${fecha} a las ${m.meeting_time}.`
    : `❌ ${m.driver_name} (${m.phone}) canceló su reunión del ${fecha} a las ${m.meeting_time}.`;
  await sendTextLogged(supabase, {
    tenantId: cfg.tenantId, templateKey: "meeting_booked", recipientType: "meetings",
    recipientName: m.driver_name, reference: `${fecha} ${m.meeting_time}`, groupId: cfg.groupId, message,
  });
}

// ─── Acciones ───

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

async function slotStillFree(supabase: any, cfg: Settings, date: string, time: string, excludeId?: string) {
  const days = await availability(supabase, cfg, excludeId);
  return !!days[date]?.includes(time);
}

async function book(supabase: any, cfg: Settings, b: any) {
  const lang = b.lang === "en" ? "en" : "es";
  const name = clean(b.name, 100), phone = clean(b.phone, 20), email = clean(b.email, 120).toLowerCase();
  const date = clean(b.date, 10), time = clean(b.time, 8);
  if (!name || !phone || !email || !date || !time || !b.truck_type) {
    return json({ error: lang === "en" ? "Please fill in all required fields." : "Completa todos los campos requeridos." }, 400);
  }
  if (!isEmail(email)) return json({ error: lang === "en" ? "Invalid email." : "Email inválido." }, 400);
  if (phone.replace(/\D/g, "").length < 10) return json({ error: lang === "en" ? "Invalid phone number." : "Teléfono inválido." }, 400);
  if (!(await slotStillFree(supabase, cfg, date, time))) {
    return json({ error: lang === "en" ? "That time was just taken. Please pick another one." : "Ese horario acaba de ocuparse. Elige otro.", slot_taken: true }, 409);
  }

  const { data: m, error } = await supabase.from("meeting_requests").insert({
    driver_name: name, phone, email,
    city: clean(b.city, 100) || null, state: clean(b.state, 2) || null,
    truck_type: clean(b.truck_type, 40), service_interest: clean(b.service_interest, 60) || null,
    comments: clean(b.comments, 1000) || null,
    meeting_date: date, meeting_time: time, duration_min: cfg.duration,
  }).select("*").single();
  if (error) throw error;

  await Promise.allSettled([
    sendInvite(m, cfg, "new", lang).catch((e) => console.error("invite:", errMsg(e))),
    syncGoogleEvent(supabase, m, cfg).catch((e) => console.error("gcal:", errMsg(e))),
    notifyGroup(supabase, cfg, m, "new").catch((e) => console.error("group:", errMsg(e))),
  ]);
  return json({ success: true, token: m.manage_token, date: m.meeting_date, time: m.meeting_time });
}

async function byToken(supabase: any, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(String(token ?? ""))) return null;
  const { data } = await supabase.from("meeting_requests").select("*").eq("manage_token", token).maybeSingle();
  return data;
}

// ─── Recordatorios por email (cron) ───

async function reminders(supabase: any, cfg: Settings) {
  const now = Date.now();
  const today = etDate(new Date());
  const { data } = await supabase
    .from("meeting_requests").select("*")
    .gte("meeting_date", today).lte("meeting_date", addDays(today, 2))
    .neq("status", "cancelled").not("email", "is", null);
  let sent = 0;
  for (const m of (data as any[]) ?? []) {
    const min = parseLabel(m.meeting_time);
    if (min === null) continue;
    const mins = (etToUtc(m.meeting_date, min).getTime() - now) / 60000;
    const which = mins > 0 && mins <= 70 && !m.email_reminder_1h_at ? "1h"
      : mins > 70 && mins <= 24 * 60 + 10 && !m.email_reminder_24h_at && (now - new Date(m.created_at).getTime()) > 3 * 3600000 ? "24h"
      : null;
    if (!which) continue;
    const col = which === "1h" ? "email_reminder_1h_at" : "email_reminder_24h_at";
    // Reservar antes de enviar: dos corridas seguidas no mandan el mismo recordatorio
    const { data: claimed } = await supabase.from("meeting_requests")
      .update({ [col]: new Date().toISOString() }).eq("id", m.id).is(col, null).select("id");
    if (!claimed?.length) continue;
    try {
      const soon = which === "1h" ? "en 1 hora" : "mañana";
      await sendMail([m.email], `Recordatorio: Reunión con 58 Dispatch Service ${soon} – ${m.meeting_time} ET`,
        emailHtml("Recordatorio de tu llamada", `Hola ${m.driver_name}, te recordamos tu reunión con 58 Dispatch Service ${soon}. Te llamaremos al ${m.phone}.`, m, "es"));
      sent++;
    } catch (e) {
      console.error("reminder:", errMsg(e));
      await supabase.from("meeting_requests").update({ [col]: null }).eq("id", m.id);
    }
  }
  return { reminders: sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const cfg = await loadSettings(supabase);

    switch (body.action) {
      case "availability":
        return json({ timezone: TZ, duration: cfg.duration, days: await availability(supabase, cfg, body.exclude_token ? (await byToken(supabase, body.exclude_token))?.id : undefined), calendar: calendarStatus.state });

      case "book":
        return await book(supabase, cfg, body);

      case "get": {
        const m = await byToken(supabase, body.token);
        if (!m) return json({ error: "No encontramos esa reunión." }, 404);
        return json({
          name: m.driver_name, date: m.meeting_date, time: m.meeting_time, duration: m.duration_min,
          cancelled: m.status === "cancelled",
          past: etToUtc(m.meeting_date, parseLabel(m.meeting_time) ?? 0).getTime() < Date.now(),
        });
      }

      case "cancel": {
        const m = await byToken(supabase, body.token);
        if (!m) return json({ error: "No encontramos esa reunión." }, 404);
        if (m.status === "cancelled") return json({ success: true });
        const { data: upd } = await supabase.from("meeting_requests")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), invite_sequence: (m.invite_sequence ?? 0) + 1, cancel_source: body.source === "crm" ? "crm" : "link" })
          .eq("id", m.id).select("*").single();
        await Promise.allSettled([
          sendInvite(upd, cfg, "cancel", body.lang).catch((e) => console.error("invite:", errMsg(e))),
          syncGoogleEvent(supabase, upd, cfg).catch((e) => console.error("gcal:", errMsg(e))),
          notifyGroup(supabase, cfg, upd, "cancel").catch((e) => console.error("group:", errMsg(e))),
        ]);
        return json({ success: true });
      }

      case "reschedule": {
        const m = await byToken(supabase, body.token);
        if (!m) return json({ error: "No encontramos esa reunión." }, 404);
        if (m.status === "cancelled") return json({ error: "Esta reunión ya fue cancelada. Agenda una nueva." }, 400);
        const date = clean(body.date, 10), time = clean(body.time, 8);
        if (!(await slotStillFree(supabase, cfg, date, time, m.id))) {
          return json({ error: "Ese horario acaba de ocuparse. Elige otro.", slot_taken: true }, 409);
        }
        const { data: upd } = await supabase.from("meeting_requests").update({
          meeting_date: date, meeting_time: time, invite_sequence: (m.invite_sequence ?? 0) + 1,
          email_reminder_24h_at: null, email_reminder_1h_at: null,
        }).eq("id", m.id).select("*").single();
        // El recordatorio de WhatsApp de 15 min usa una clave por reunión: se libera para la nueva hora
        await supabase.from("whatsapp_message_log").delete().eq("message_key", `meeting:${m.id}`);
        await Promise.allSettled([
          sendInvite(upd, cfg, "update", body.lang).catch((e) => console.error("invite:", errMsg(e))),
          syncGoogleEvent(supabase, upd, cfg).catch((e) => console.error("gcal:", errMsg(e))),
          notifyGroup(supabase, cfg, upd, "update").catch((e) => console.error("group:", errMsg(e))),
        ]);
        return json({ success: true, date: upd.meeting_date, time: upd.meeting_time });
      }

      // Reenviar la invitación de una reunión (pruebas / soporte), solo con x-cron-secret
      case "resend": {
        const secret = Deno.env.get("CRON_SECRET");
        if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
        const m = await byToken(supabase, body.token);
        if (!m) return json({ error: "No encontramos esa reunión." }, 404);
        if (!body.calendar_only) await sendInvite(m, cfg, m.status === "cancelled" ? "cancel" : "new", body.lang ?? "es");
        await syncGoogleEvent(supabase, m, cfg);
        return json({ success: true });
      }

      case "reminders": {
        const secret = Deno.env.get("CRON_SECRET");
        if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
        return json(await reminders(supabase, cfg));
      }
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("booking error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

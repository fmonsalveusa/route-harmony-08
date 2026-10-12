// deno-lint-ignore-file no-explicit-any
// Relojes HOS de los drivers en nuestras cuentas de ELD (Until Break, Driving, Shift, Cycle), cada hora.
//  • HOS247: el portal los entrega calculados; se ajustan por el tiempo transcurrido desde la lectura.
//  • RouteOne: el portal los calcula en el navegador a partir de los eventos del día; aquí se hace
//    el mismo cálculo (reglas FMCSA de carga: 11 h manejo, 14 h turno, 30 min de descanso tras 8 h
//    manejando, 70 h en 8 días con reinicio de 34 h). No contempla split sleeper ni excepciones.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { driverConnections, hos247, markConnection, routeOne, type EldCreds } from "../_shared/eld.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const MIN = 60_000, HOUR = 60 * MIN;
const LIMIT = { break: 8 * HOUR, drive: 11 * HOUR, shift: 14 * HOUR, reset: 10 * HOUR, restart: 34 * HOUR, breakRest: 30 * MIN };

type Duty = "driving" | "on_duty" | "off_duty" | "sleeper" | "personal_conveyance" | "yard_move";
interface Clocks {
  name: string; unit: string | null; vin: string | null; source: "HOS247" | "RouteOne";
  duty: Duty | null; since: string | null; untilBreak: number; drive: number; shift: number; cycle: number;
  cycleLimit: number; computed: boolean; reportedAt: string | null;
}

const mins = (ms: number) => Math.max(0, Math.round(ms / MIN));
const normName = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const working = (d: Duty) => d === "driving" || d === "on_duty" || d === "yard_move";

// ─── HOS247 ───
const HOS_DUTY: Record<string, Duty> = { DS_D: "driving", DS_ON: "on_duty", DS_OFF: "off_duty", DS_SB: "sleeper", DR_IND_PC: "personal_conveyance", DR_IND_YM: "yard_move" };

async function readHos247(now: number, creds?: EldCreds): Promise<Clocks[]> {
  const { get } = await hos247(creds);
  const [statuses, users, vehicles] = await Promise.all([
    get("/latest_driver_statuses?$limit=500"), get("/users?$limit=500"), get("/vehicles?$limit=500"),
  ]);
  return statuses.flatMap((s) => {
    const u = users.find((x) => x._id === s.userId);
    if (!u || u.active === false || !s.driveTime) return [];
    const duty = HOS_DUTY[s.hosEvent?.eventCode?.id] ?? null;
    const statusStart = Number(s.hosEvent?.eventTime?.timestamp) || Number(s.stime);
    // Los acumulados son del momento de la lectura (stime); se avanzan hasta ahora
    const elapsed = Math.max(0, now - Number(s.stime));
    const left = (t: any) => Number(t?.limitTime) - Number(t?.accumulatedTime);
    let untilBreak = left(s.breakTime), drive = left(s.driveTime), shift = left(s.shiftTime), cycle = left(s.cycleTime);
    const offFor = now - statusStart;
    if (duty === "driving") { drive -= elapsed; shift -= elapsed; untilBreak -= elapsed; cycle -= elapsed; }
    else if (duty && working(duty)) { shift -= elapsed; cycle -= elapsed; if (offFor >= LIMIT.breakRest) untilBreak = Number(s.breakTime?.limitTime) || LIMIT.break; }
    else {
      shift -= elapsed; // el turno de 14 h corre aunque esté descansando
      if (offFor >= LIMIT.breakRest) untilBreak = Number(s.breakTime?.limitTime) || LIMIT.break;
      if (offFor >= LIMIT.reset) { drive = Number(s.driveTime?.limitTime); shift = Number(s.shiftTime?.limitTime); }
      if (offFor >= LIMIT.restart) cycle = Number(s.cycleTime?.limitTime);
    }
    const vin = s.vehicle?.vin ?? null;
    return [{
      name: [u.firstName, u.lastName].filter(Boolean).join(" "), unit: vehicles.find((v) => v.vin === vin)?.name ?? null, vin,
      source: "HOS247" as const, duty, since: statusStart ? new Date(statusStart).toISOString() : null,
      untilBreak: mins(untilBreak), drive: mins(drive), shift: mins(shift), cycle: mins(cycle),
      cycleLimit: mins(Number(s.cycleTime?.limitTime) || 70 * HOUR), computed: false, reportedAt: new Date(Number(s.stime)).toISOString(),
    }];
  });
}

// ─── RouteOne: cálculo a partir de los eventos ───
interface Span { duty: Duty; start: number; end: number }

/** Eventos ELD → tramos de estado. Tipo 1: 1 off, 2 sleeper, 3 driving, 4 on. Tipo 3: 1 PC, 2 YM, 0 fin. */
function timeline(events: any[], now: number): Span[] {
  const changes: { t: number; duty: Duty }[] = [];
  let base: Duty = "off_duty";
  for (const e of events.filter((x) => x.eventRecordStatus == null || Number(x.eventRecordStatus) === 1)
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))) {
    const t = Date.parse(e.datetime), type = Number(e.eventType), code = Number(e.eventCode);
    if (type === 1 && code >= 1 && code <= 4) {
      base = (["off_duty", "sleeper", "driving", "on_duty"] as Duty[])[code - 1];
      changes.push({ t, duty: base });
    } else if (type === 3) {
      changes.push({ t, duty: code === 1 ? "personal_conveyance" : code === 2 ? "yard_move" : base });
    }
  }
  const spans: Span[] = [];
  changes.forEach((c, i) => {
    const end = i + 1 < changes.length ? changes[i + 1].t : now;
    if (end > c.t) spans.push({ duty: c.duty, start: c.t, end });
  });
  // Tramos seguidos del mismo estado se unen
  return spans.reduce<Span[]>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.duty === s.duty && last.end === s.start) last.end = s.end; else acc.push({ ...s });
    return acc;
  }, []);
}

/** Último descanso de al menos `need` ms seguidos (off/sleeper/PC) que termina antes de `before` */
function lastRest(spans: Span[], need: number, before: number): Span | null {
  let run: Span | null = null, found: Span | null = null;
  for (const s of spans) {
    if (s.start >= before) break;
    if (!working(s.duty)) run = run && run.end === s.start ? { ...run, end: s.end } : { ...s };
    else run = null;
    if (run && run.end - run.start >= need) found = { ...run };
  }
  return found;
}

const overlap = (s: Span, from: number, to: number) => Math.max(0, Math.min(s.end, to) - Math.max(s.start, from));

function computeClocks(spans: Span[], now: number, cycleHours: number) {
  const cycleLimit = cycleHours * HOUR;
  const cur = spans[spans.length - 1];
  // Reinicio de turno: 10 h seguidas sin trabajar
  const reset = lastRest(spans, LIMIT.reset, now);
  const resetEnd = reset ? reset.end : spans[0]?.start ?? now;
  const inReset = !!reset && reset.end >= now;
  const shiftStart = inReset ? null : spans.find((s) => s.start >= resetEnd && working(s.duty))?.start ?? null;

  let drive = LIMIT.drive, shift = LIMIT.shift;
  if (shiftStart != null) {
    drive -= spans.filter((s) => s.duty === "driving").reduce((n, s) => n + overlap(s, shiftStart, now), 0);
    shift -= now - shiftStart;
  }
  // Descanso de 30 min: manejo desde el último tramo de 30 min seguidos sin manejar
  let breakFrom = resetEnd, run = 0, runStart = 0;
  for (const s of spans) {
    if (s.duty !== "driving") { if (!run) runStart = s.start; run += s.end - s.start; if (run >= LIMIT.breakRest) breakFrom = Math.max(breakFrom, s.end); }
    else run = 0;
  }
  void runStart;
  const untilBreak = LIMIT.break - spans.filter((s) => s.duty === "driving").reduce((n, s) => n + overlap(s, breakFrom, now), 0);
  // Ciclo: horas trabajadas en los últimos 8 (o 7) días, desde el último reinicio de 34 h
  const days = cycleHours === 60 ? 7 : 8;
  const restart = lastRest(spans, LIMIT.restart, now);
  const from = Math.max(now - days * 24 * HOUR, restart ? restart.end : 0);
  const cycle = cycleLimit - spans.filter((s) => working(s.duty)).reduce((n, s) => n + overlap(s, from, now), 0);

  return {
    duty: cur?.duty ?? null, since: cur ? new Date(cur.start).toISOString() : null,
    untilBreak: mins(untilBreak), drive: mins(drive), shift: mins(shift), cycle: mins(cycle), cycleLimit: mins(cycleLimit),
  };
}

async function readRouteOne(now: number, creds?: EldCreds): Promise<Clocks[]> {
  const { gql } = await routeOne(creds);
  const list = await gql(
    "query ActiveDriversList($sort: ActiveDriversSortInput!, $filter: ActiveDriversFilterInput!) { activeDriversList(sort: $sort, filter: $filter) { id firstName lastName vehicleId lastReportedTime eventDatetime homeTerminalTimeZone } }",
    { sort: { field: "LAST_ACTIVITY", order: "DESC" }, filter: { dutyStatus: [], search: "", vehicleStatus: [] } },
  );
  const out: Clocks[] = [];
  for (const d of (list?.activeDriversList ?? []) as any[]) {
    // 9 días de eventos para cubrir el ciclo de 8 días y el turno que viene del día anterior
    const events: any[] = [];
    let hosType = 1;
    for (let i = 8; i >= 0; i--) {
      const date = new Date(now - i * 24 * HOUR).toISOString().slice(0, 10);
      try {
        const r = await gql(
          "query ListDriverEventsByDay($driverId: Float!, $date: DateTime!) { listDriverEventsByDay(data: {driverId: $driverId, date: $date}) { profile events { eventType eventCode datetime eventRecordStatus } } }",
          { driverId: Number(d.id), date },
        );
        const day = r?.listDriverEventsByDay;
        events.push(...(day?.events ?? []));
        if (day?.profile?.hostype != null) hosType = Number(day.profile.hostype);
      } catch { /* día sin datos */ }
    }
    const seen = new Set<string>();
    const unique = events.filter((e) => { const k = `${e.datetime}|${e.eventType}|${e.eventCode}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const spans = timeline(unique, now);
    if (spans.length === 0) continue;
    // hostype 1 = 70 h / 8 días (lo que muestra el perfil); otro valor = 60 h / 7 días
    const c = computeClocks(spans, now, hosType === 1 ? 70 : 60);
    out.push({
      name: [d.firstName, d.lastName].filter(Boolean).join(" "), unit: d.vehicleId ? String(d.vehicleId) : null, vin: null,
      source: "RouteOne", ...c, computed: true, reportedAt: d.lastReportedTime ?? d.eventDatetime ?? null,
    });
  }
  return out;
}

async function sync(supabase: any) {
  const now = Date.now();
  const errors: string[] = [];
  const clocks: Clocks[] = [];
  for (const [name, read] of [["HOS247", readHos247], ["RouteOne", readRouteOne]] as const) {
    try { clocks.push(...await read(now)); } catch (e) { errors.push(`${name}: ${errMsg(e)}`); }
  }

  const { data: allDrivers } = await supabase
    .from("drivers").select("id, name, tenant_id, truck_id, status, service_type").neq("status", "inactive");
  const { data: trucks } = await supabase.from("trucks").select("id, unit_number, vin");
  const saved: unknown[] = [], unmatched: string[] = [];
  const truckOf = (d: any) => ((trucks as any[]) || []).find((t) => String(t.id) === String(d.truck_id));
  const save = async (d: any, best: Clocks) => {
    await supabase.from("driver_hos_clocks").upsert({
      driver_id: d.id, tenant_id: d.tenant_id, source: best.source, duty_status: best.duty, status_since: best.since,
      until_break_min: best.untilBreak, driving_min: best.drive, shift_min: best.shift, cycle_min: best.cycle,
      cycle_limit_min: best.cycleLimit, computed: best.computed, eld_name: best.name, reported_at: best.reportedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "driver_id" });
    saved.push({ driver: d.name, source: best.source, duty: best.duty, break: best.untilBreak, drive: best.drive, shift: best.shift, cycle: best.cycle });
  };

  // Conexiones propias (usuario del driver en su ELD): su cuenta manda
  const own = await driverConnections(supabase);
  const withOwn = new Set(own.map((c) => c.driver_id));
  for (const c of own) {
    const d = ((allDrivers as any[]) || []).find((x) => x.id === c.driver_id);
    if (!d) continue;
    try {
      const list = c.provider === "hos247" ? await readHos247(now, c.creds) : await readRouteOne(now, c.creds);
      const truck = truckOf(d);
      const pick = list.filter((x) => normName(x.name) === normName(d.name))
        .concat(list.filter((x) => truck && ((x.unit && String(x.unit) === String(truck.unit_number)) || (x.vin && truck.vin && x.vin === truck.vin))));
      const best = (pick.length ? pick : list.length === 1 ? list : [])
        .reduce<Clocks | null>((a, b) => (!a || Date.parse(b.reportedAt ?? "0") > Date.parse(a.reportedAt ?? "0") ? b : a), null);
      await markConnection(supabase, d.id, true);
      if (best) await save(d, best); else unmatched.push(`${d.name} (cuenta propia sin datos)`);
    } catch (e) {
      await markConnection(supabase, d.id, false, errMsg(e));
      errors.push(`${d.name}: ${errMsg(e)}`);
    }
  }

  // Cuentas de flota de la empresa: company drivers y owner operators bajo nuestro MC
  // (Dispatch Service usa su propio ELD)
  const drivers = ((allDrivers as any[]) || []).filter((d) => d.service_type !== "dispatch_service" && !withOwn.has(d.id));
  for (const d of drivers) {
    const truck = truckOf(d);
    // Por nombre; si no, por el camión asignado. Si hay varias cuentas, la lectura más reciente.
    const candidates = clocks.filter((c) => normName(c.name) === normName(d.name));
    const byTruck = clocks.filter((c) => truck && ((c.unit && String(c.unit) === String(truck.unit_number)) || (c.vin && truck.vin && c.vin === truck.vin)));
    const pool = candidates.length ? candidates : byTruck;
    if (pool.length === 0) { unmatched.push(d.name); continue; }
    const best = pool.reduce((a, b) => (Date.parse(b.reportedAt ?? "0") > Date.parse(a.reportedAt ?? "0") ? b : a));
    await save(d, best);
  }
  return { saved, unmatched, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const secret = Deno.env.get("CRON_SECRET");
    const fromCron = !!secret && req.headers.get("x-cron-secret") === secret;
    if (!fromCron) {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!((roles as any[]) || []).some((r) => ["admin", "accounting", "dispatcher", "master_admin"].includes(r.role))) {
        return json({ error: "Unauthorized" }, 403);
      }
    }
    const result = await sync(supabase);
    console.log("eld-hos:", JSON.stringify(result));
    return json(result);
  } catch (e) {
    console.error("eld-hos error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

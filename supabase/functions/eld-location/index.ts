// deno-lint-ignore-file no-explicit-any
// Ubicación del camión desde el ELD (HOS247 y RouteOne) como respaldo del GPS de la app.
// Cada 2 minutos: si la app del driver no mandó GPS en los últimos 10 minutos, se guarda la
// posición del ELD en driver_locations (source 'eld'). Como entra por la misma tabla, la llegada
// automática a las paradas (trigger) y los emails al broker funcionan igual.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hos247, routeOne } from "../_shared/eld.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const APP_GPS_FRESH_MS = 10 * 60_000;   // la app manda: se respeta su GPS
const ELD_MAX_AGE_MS = 6 * 3600_000;     // una posición del ELD más vieja que esto no sirve
const MPH_TO_MS = 1 / 2.23694;

interface Pos { source: string; unit: string | null; vin: string | null; lat: number; lng: number; speedMs: number | null; at: number }

const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

function miles(a: [number, number], b: [number, number]) {
  const R = 3958.8, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function readHos247(): Promise<Pos[]> {
  const { get } = await hos247();
  const [vehicles, statuses] = await Promise.all([get("/vehicles?$limit=500"), get("/latest_vehicle_statuses?$limit=500")]);
  return statuses.flatMap((s) => {
    const lat = Number(s.lat), lng = Number(s.lon);
    if (!lat || !lng) return [];
    const v = vehicles.find((x) => norm(x.vin) === norm(s.vin));
    // HOS247 no trae velocidad: se calcula con la lectura anterior
    return [{ source: "HOS247", unit: v?.name ?? null, vin: s.vin ?? null, lat, lng, speedMs: null, at: Number(s.timestamp) }];
  });
}

async function readRouteOne(): Promise<Pos[]> {
  const { gql } = await routeOne();
  const r = await gql(
    "query ActiveDriversList($sort: ActiveDriversSortInput!, $filter: ActiveDriversFilterInput!) { activeDriversList(sort: $sort, filter: $filter) { vehicleId speed latitude longitude lastReportedTime } }",
    { sort: { field: "LAST_ACTIVITY", order: "DESC" }, filter: { dutyStatus: [], search: "", vehicleStatus: [] } },
  );
  return ((r?.activeDriversList ?? []) as any[]).flatMap((d) => {
    const lat = Number(d.latitude), lng = Number(d.longitude);
    if (!lat || !lng || !d.vehicleId) return [];
    const mph = Number(d.speed);
    return [{ source: "RouteOne", unit: String(d.vehicleId), vin: null, lat, lng, speedMs: Number.isFinite(mph) ? mph * MPH_TO_MS : null, at: Date.parse(d.lastReportedTime) || Date.now() }];
  });
}

async function sync(supabase: any) {
  const now = Date.now();
  const errors: string[] = [];
  const positions: Pos[] = [];
  for (const [name, read] of [["HOS247", readHos247], ["RouteOne", readRouteOne]] as const) {
    try { positions.push(...await read()); } catch (e) { errors.push(`${name}: ${errMsg(e)}`); }
  }
  if (positions.length === 0) return { saved: 0, errors };

  const [{ data: trucks }, { data: drivers }, { data: locs }] = await Promise.all([
    supabase.from("trucks").select("id, unit_number, vin"),
    supabase.from("drivers").select("id, name, tenant_id, truck_id, status, service_type").neq("status", "inactive"),
    supabase.from("driver_locations").select("driver_id, lat, lng, source, updated_at"),
  ]);
  const saved: unknown[] = [];
  for (const d of (drivers as any[]) || []) {
    if (d.service_type === "dispatch_service" || !d.truck_id) continue; // usan su propio ELD
    const truck = ((trucks as any[]) || []).find((t) => String(t.id) === String(d.truck_id));
    if (!truck) continue;
    const pos = positions
      .filter((p) => (p.unit && norm(p.unit) === norm(truck.unit_number)) || (p.vin && truck.vin && norm(p.vin) === norm(truck.vin)))
      .sort((a, b) => b.at - a.at)[0];
    if (!pos || now - pos.at > ELD_MAX_AGE_MS) continue;

    const prev = ((locs as any[]) || []).find((l) => l.driver_id === d.id);
    const prevAt = prev ? Date.parse(prev.updated_at) : 0;
    // La app del driver tiene prioridad mientras siga mandando
    if (prev && prev.source !== "eld" && now - prevAt < APP_GPS_FRESH_MS) continue;
    // Nada nuevo desde la última lectura
    if (prev && pos.at <= prevAt) continue;

    let speed = pos.speedMs;
    if (speed == null && prev?.source === "eld" && pos.at > prevAt) {
      const hours = (pos.at - prevAt) / 3600_000;
      const mph = hours > 0 ? miles([prev.lat, prev.lng], [pos.lat, pos.lng]) / hours : 0;
      speed = mph > 0 && mph < 100 ? mph * MPH_TO_MS : 0;
    }
    await supabase.from("driver_locations").upsert({
      driver_id: d.id, tenant_id: d.tenant_id, lat: pos.lat, lng: pos.lng, speed, heading: null, accuracy: null,
      source: "eld", updated_at: new Date(pos.at).toISOString(),
    }, { onConflict: "driver_id" });
    saved.push({ driver: d.name, unit: truck.unit_number, from: pos.source, mph: speed != null ? Math.round(speed / MPH_TO_MS) : null });
  }
  return { saved, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const result = await sync(supabase);
    if ((result.saved as any[]).length || result.errors.length) console.log("eld-location:", JSON.stringify(result));
    return json(result);
  } catch (e) {
    console.error("eld-location error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

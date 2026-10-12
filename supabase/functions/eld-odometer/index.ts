// deno-lint-ignore-file no-explicit-any
// Odómetro automático desde los portales de ELD (HOS247 y RouteOne).
// Entra con el usuario de flota de cada portal (secretos de Supabase), lee el último odómetro
// de cada camión y actualiza los camiones con mantenimientos recurrentes; luego recalcula
// millas acumuladas y estado de cada mantenimiento (el trigger avisa por WhatsApp si empeora).
//  • cron (x-cron-secret) dos veces al día
//  • botón "Actualizar desde ELD" en Maintenance (usuario del equipo)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Una lectura nueva más alta que esto sobre la anterior se descarta (dato raro del ELD)
const MAX_JUMP_MILES = 5000;

interface Reading { source: string; unit: string; vin: string | null; odometer: number; at: string | null }

const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

/** HOS247 (backend Feathers de apexhos): /authentication → /vehicles + /latest_vehicle_statuses */
async function readHos247(): Promise<Reading[]> {
  const email = Deno.env.get("HOS247_EMAIL"), password = Deno.env.get("HOS247_PASSWORD");
  if (!email || !password) throw new Error("Faltan los secretos HOS247_EMAIL / HOS247_PASSWORD");
  const base = Deno.env.get("HOS247_BASE_URL") || "https://kindzadza.apexhos.com";
  const auth = await fetch(`${base}/authentication`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "local", email, password }),
  });
  const a = await auth.json().catch(() => ({}));
  const token = a.accessToken ?? a.token;
  if (!auth.ok || !token) throw new Error(`HOS247 login HTTP ${auth.status}: ${String(a.message ?? "").slice(0, 120)}`);
  const get = async (path: string) => {
    const r = await fetch(`${base}${path}`, { headers: { Authorization: token } });
    if (!r.ok) throw new Error(`HOS247 ${path} HTTP ${r.status}`);
    const j = await r.json();
    return (Array.isArray(j) ? j : j.data ?? []) as any[];
  };
  const [vehicles, statuses] = await Promise.all([get("/vehicles?$limit=500"), get("/latest_vehicle_statuses?$limit=500")]);
  return vehicles.flatMap((v) => {
    const s = statuses.find((x) => norm(x.vin) === norm(v.vin));
    const odo = Number(s?.odometer);
    return odo > 0 ? [{ source: "HOS247", unit: String(v.name ?? ""), vin: v.vin ?? null, odometer: odo, at: s?.timestamp ? new Date(s.timestamp).toISOString() : null }] : [];
  });
}

/** RouteOne GO (GraphQL): Login → odómetro en vivo de los camiones activos + último registrado */
async function readRouteOne(): Promise<Reading[]> {
  const login = Deno.env.get("ROUTEONE_LOGIN"), password = Deno.env.get("ROUTEONE_PASSWORD");
  if (!login || !password) throw new Error("Faltan los secretos ROUTEONE_LOGIN / ROUTEONE_PASSWORD");
  const url = "https://client.routeonego.com/api/gql";
  const gql = async (query: string, variables: Record<string, unknown>, token?: string) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors?.length) throw new Error(`RouteOne HTTP ${r.status}: ${String(j.errors?.[0]?.message ?? "").slice(0, 120)}`);
    return j.data;
  };
  const auth = await gql(
    "mutation Login($login: String!, $password: String!) { login(data: { login: $login, password: $password }) { tokens { token } } }",
    { login, password },
  );
  const token = auth?.login?.tokens?.token;
  if (!token) throw new Error("RouteOne: el login no devolvió token");

  const [live, assets] = await Promise.all([
    gql(
      "query ActiveDriversList($sort: ActiveDriversSortInput!, $filter: ActiveDriversFilterInput!) { activeDriversList(sort: $sort, filter: $filter) { vehicleId odometer lastReportedTime eventDatetime } }",
      { sort: { field: "LAST_ACTIVITY", order: "DESC" }, filter: { dutyStatus: [], search: "", vehicleStatus: [] } }, token,
    ),
    gql(
      "query MaintenanceAssignableAssets($input: AssignableAssetsInput!) { maintenanceAssignableAssets(input: $input) { assetLabel lastOdometer } }",
      { input: { assetType: "vehicle" } }, token,
    ),
  ]);
  const out = new Map<string, Reading>();
  for (const a of (assets?.maintenanceAssignableAssets ?? []) as any[]) {
    const odo = Number(a.lastOdometer);
    if (odo > 0) out.set(norm(a.assetLabel), { source: "RouteOne", unit: String(a.assetLabel), vin: null, odometer: odo, at: null });
  }
  // El odómetro en vivo de los camiones activos es más reciente: manda si es mayor
  for (const d of (live?.activeDriversList ?? []) as any[]) {
    const odo = Number(d.odometer);
    const prev = out.get(norm(d.vehicleId));
    if (odo > 0 && (!prev || odo >= prev.odometer)) {
      out.set(norm(d.vehicleId), { source: "RouteOne", unit: String(d.vehicleId), vin: null, odometer: odo, at: d.lastReportedTime ?? d.eventDatetime ?? null });
    }
  }
  return [...out.values()];
}

/** Igual que recalculateMiles del TMS: acumulado = odómetro − last_miles, y estado por millas/fecha */
async function recalcMaintenance(supabase: any, truckId: string, odometer: number) {
  const { data: items } = await supabase.from("truck_maintenance").select("*").eq("truck_id", truckId);
  for (const item of (items as any[]) || []) {
    const miles = item.last_miles > 0 ? Math.max(0, odometer - Number(item.last_miles)) : 0;
    let milesStatus = "ok";
    if (item.interval_miles > 0) {
      const pct = miles / Number(item.interval_miles);
      milesStatus = pct >= 1 ? "due" : pct >= 0.8 ? "warning" : "ok";
    }
    let dateStatus = "ok";
    if (item.next_due_date) {
      const days = (Date.parse(item.next_due_date) - Date.now()) / 86400000;
      dateStatus = days <= 0 ? "due" : days <= 30 ? "warning" : "ok";
    }
    const rank: Record<string, number> = { ok: 0, warning: 1, due: 2 };
    const status = rank[dateStatus] >= rank[milesStatus] ? dateStatus : milesStatus;
    if (Number(item.miles_accumulated) === miles && item.status === status) continue;
    await supabase.from("truck_maintenance").update({ miles_accumulated: miles, status }).eq("id", item.id);
    if (status !== item.status && (status === "warning" || status === "due")) {
      await supabase.from("notifications").insert({
        tenant_id: item.tenant_id, type: "maintenance",
        title: `Maintenance ${status === "due" ? "⚠️ OVERDUE" : "⚡ Approaching"}`,
        message: `${item.maintenance_type} for truck is ${status === "due" ? "overdue" : "approaching due"}. ${miles.toLocaleString()} mi accumulated.`,
      });
    }
  }
}

async function sync(supabase: any, tenantId?: string) {
  const errors: string[] = [];
  const readings: Reading[] = [];
  for (const [name, read] of [["HOS247", readHos247], ["RouteOne", readRouteOne]] as const) {
    try { readings.push(...await read()); } catch (e) { errors.push(`${name}: ${errMsg(e)}`); }
  }

  // Solo los camiones con mantenimientos recurrentes (los propios, de company drivers)
  const { data: maint } = await supabase.from("truck_maintenance").select("truck_id, tenant_id");
  const truckIds = [...new Set(((maint as any[]) || []).filter((m) => !tenantId || m.tenant_id === tenantId).map((m) => m.truck_id))];
  if (truckIds.length === 0) return { updated: [], errors };
  const { data: trucks } = await supabase.from("trucks").select("id, unit_number, vin, current_odometer").in("id", truckIds);

  const updated: unknown[] = [], skipped: unknown[] = [];
  for (const t of (trucks as any[]) || []) {
    // Por unidad y, si no, por VIN; si los dos portales lo tienen, la lectura más alta
    const matches = readings.filter((r) => norm(r.unit) === norm(t.unit_number) || (r.vin && t.vin && norm(r.vin) === norm(t.vin)));
    if (matches.length === 0) { skipped.push({ unit: t.unit_number, reason: "no está en los ELD" }); continue; }
    const best = matches.reduce((a, b) => (b.odometer > a.odometer ? b : a));
    const odometer = Math.round(best.odometer);
    const current = Number(t.current_odometer) || 0;
    if (odometer <= current) { skipped.push({ unit: t.unit_number, reason: "sin cambio", odometer, current }); continue; }
    if (current > 0 && odometer - current > MAX_JUMP_MILES) {
      skipped.push({ unit: t.unit_number, reason: `salto raro de ${odometer - current} mi`, odometer, current });
      continue;
    }
    await supabase.from("trucks").update({ current_odometer: odometer, odometer_updated_at: new Date().toISOString() }).eq("id", t.id);
    await recalcMaintenance(supabase, t.id, odometer);
    updated.push({ unit: t.unit_number, from: current, to: odometer, source: best.source });
  }
  return { updated, skipped, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const secret = Deno.env.get("CRON_SECRET");
    if (secret && req.headers.get("x-cron-secret") === secret) {
      const result = await sync(supabase);
      console.log("eld-odometer:", JSON.stringify(result));
      return json(result);
    }
    // Botón del TMS: solo el equipo (admin, accounting, dispatcher)
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!((roles as any[]) || []).some((r) => ["admin", "accounting", "dispatcher", "master_admin"].includes(r.role))) {
      return json({ error: "Unauthorized" }, 403);
    }
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    return json(await sync(supabase, profile?.tenant_id ?? undefined));
  } catch (e) {
    console.error("eld-odometer error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

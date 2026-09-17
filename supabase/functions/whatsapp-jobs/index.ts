// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhapiText } from "../_shared/whapi.ts";
import { loadHasPod, cityState, timeWindow, todayET, usDate, sleep } from "../_shared/loadHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ACTIVE_EXCLUDED = ["delivered", "tonu", "paid", "cancelled"];
const SEND_GAP_MS = 1500; // espaciar envíos para no parecer spam
const MAX_POD_REMINDERS = 3;

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);
const etHour = () => Number(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }));

type Supa = ReturnType<typeof createClient>;

/** Reserva un mensaje único; false si ya se había enviado */
async function claim(supabase: Supa, tenantId: string, key: string): Promise<boolean> {
  const { error } = await supabase.from("whatsapp_message_log").insert({ tenant_id: tenantId, message_key: key });
  return !error;
}
async function release(supabase: Supa, key: string) {
  await supabase.from("whatsapp_message_log").delete().eq("message_key", key);
}

async function sendOnce(supabase: Supa, tenantId: string, key: string, groupId: string, text: string) {
  if (!(await claim(supabase, tenantId, key))) return false;
  try {
    await sendWhapiText(groupId, text);
    await sleep(SEND_GAP_MS);
    return true;
  } catch (e) {
    await release(supabase, key);
    console.error(`Send failed (${key}):`, e);
    return false;
  }
}

// ─── POD ─────────────────────────────────────────────────────────────────────
async function runPodReminders(supabase: Supa, tenant: any) {
  const hour = etHour();
  if (hour < 7 || hour >= 21) return { pod: "outside hours" };

  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, driver_id, delivered_at, pod_reminder_count, pod_reminder_sent_at")
    .eq("tenant_id", tenant.id)
    .eq("status", "delivered")
    .not("delivered_at", "is", null)
    .is("whatsapp_delivered_sent_at", null)
    .not("driver_id", "is", null)
    .lte("delivered_at", twoHoursAgo)
    .lt("pod_reminder_count", MAX_POD_REMINDERS);

  let reminders = 0;
  let completed = 0;
  for (const load of (loads as any[]) || []) {
    if (load.pod_reminder_sent_at && load.pod_reminder_sent_at > oneDayAgo) continue;

    // Si el POD ya llegó por otra vía, disparar el mensaje de "completada"
    if (await loadHasPod(supabase, load.id)) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/load-whatsapp-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET")! },
        body: JSON.stringify({ load_id: load.id, event: "delivered" }),
      });
      completed++;
      continue;
    }

    const { data: driver } = await supabase
      .from("drivers").select("whatsapp_group_id").eq("id", load.driver_id).maybeSingle();
    if (!driver?.whatsapp_group_id) continue;

    const count = Number(load.pod_reminder_count) || 0;
    const key = `pod:${load.id}:${load.delivered_at}:${count + 1}`;
    const text = `La carga #${load.reference_number} fue marcada como entregada, pero todavía no hemos recibido el POD. Por favor súbelo en la app móvil lo antes posible; lo necesitamos para cobrar la carga.`;
    if (await sendOnce(supabase, tenant.id, key, driver.whatsapp_group_id, text)) {
      await supabase.from("loads")
        .update({ pod_reminder_count: count + 1, pod_reminder_sent_at: new Date().toISOString() })
        .eq("id", load.id);
      reminders++;
    }
  }
  return { pod_reminders: reminders, pod_completed: completed };
}

// ─── Paradas de hoy ──────────────────────────────────────────────────────────
interface TodayStop {
  loadId: string; ref: string; driverId: string | null; loadStatus: string;
  type: "pickup" | "delivery"; address: string; time: string | null; order: number;
}

async function getTodayStops(supabase: Supa, tenantId: string, today: string): Promise<TodayStop[]> {
  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, driver_id, status, origin, destination, pickup_date, delivery_date, pickup_time, delivery_time")
    .eq("tenant_id", tenantId)
    .not("status", "in", `(${ACTIVE_EXCLUDED.join(",")})`);
  const active = (loads as any[]) || [];
  if (active.length === 0) return [];

  const { data: stops } = await supabase
    .from("load_stops")
    .select("load_id, stop_type, address, date, time, stop_order, arrived_at")
    .in("load_id", active.map((l) => l.id));

  const result: TodayStop[] = [];
  const loadsWithStops = new Set(((stops as any[]) || []).map((s) => s.load_id));
  const byId = new Map(active.map((l) => [l.id, l]));

  for (const s of (stops as any[]) || []) {
    if ((s.date || "").split("T")[0] !== today || s.arrived_at) continue;
    const l = byId.get(s.load_id);
    if (!l) continue;
    result.push({ loadId: l.id, ref: l.reference_number, driverId: l.driver_id, loadStatus: l.status,
      type: s.stop_type, address: s.address, time: s.time, order: s.stop_order ?? 0 });
  }
  // Cargas sin paradas registradas: usar origen/destino de la carga
  for (const l of active) {
    if (loadsWithStops.has(l.id)) continue;
    if ((l.pickup_date || "").split("T")[0] === today) {
      result.push({ loadId: l.id, ref: l.reference_number, driverId: l.driver_id, loadStatus: l.status,
        type: "pickup", address: l.origin, time: l.pickup_time, order: 0 });
    }
    if ((l.delivery_date || "").split("T")[0] === today) {
      result.push({ loadId: l.id, ref: l.reference_number, driverId: l.driver_id, loadStatus: l.status,
        type: "delivery", address: l.destination, time: l.delivery_time, order: 99 });
    }
  }
  // Un pickup de una carga que ya se recogió no hace falta recordarlo
  return result.filter((s) => !(s.type === "pickup" && ["picked_up", "on_site_delivery"].includes(s.loadStatus)));
}

function dailyMessage(items: TodayStop[]): string {
  const where = (s: TodayStop) => [cityState(s.address), timeWindow(s.time)].filter(Boolean).join(" ");
  if (items.length === 1) {
    const s = items[0];
    return s.type === "pickup"
      ? `Buen día. Le recordamos que hoy tenemos el pickup de la carga #${s.ref} programado en ${where(s)}. ¿A qué hora estimas la llegada?`
      : `Buen día. Le recordamos que hoy tenemos la entrega de la carga #${s.ref} programada en ${where(s)}. ¿A qué hora estimas la entrega?`;
  }
  const lines = items.map((s) => `• ${s.type === "pickup" ? "Pickup" : "Entrega"} de la carga #${s.ref} en ${where(s)}`);
  return `Buen día. Le recordamos lo programado para hoy:\n${lines.join("\n")}\n¿A qué hora estimas llegar a cada parada?`;
}

async function runDailyReminders(supabase: Supa, tenant: any, today: string, stops: TodayStop[]) {
  const byDriver = new Map<string, TodayStop[]>();
  for (const s of stops) {
    if (!s.driverId) continue;
    (byDriver.get(s.driverId) ?? byDriver.set(s.driverId, []).get(s.driverId)!).push(s);
  }
  let sent = 0;
  for (const [driverId, items] of byDriver) {
    const { data: driver } = await supabase
      .from("drivers").select("whatsapp_group_id").eq("id", driverId).maybeSingle();
    if (!driver?.whatsapp_group_id) continue;
    items.sort((a, b) => (a.type === b.type ? a.order - b.order : a.type === "pickup" ? -1 : 1));
    if (await sendOnce(supabase, tenant.id, `daily:${driverId}:${today}`, driver.whatsapp_group_id, dailyMessage(items))) sent++;
  }
  return { daily_reminders: sent };
}

// ─── Vencimientos ────────────────────────────────────────────────────────────
const DRIVER_DOCS: Record<string, string> = {
  license_expiry: "la licencia de conducir",
  medical_card_expiry: "la medical card",
};
const TRUCK_DOCS: Record<string, string> = {
  insurance_expiry: "el seguro",
  registration_expiry: "el registration",
  annual_inspection_expiry: "la annual inspection",
};

function expiryMessage(subject: string, expiry: string, days: number): string | null {
  const date = usDate(expiry);
  if (days === 30 || days === 7) {
    return `Recordatorio: ${subject} vence el ${date} (en ${days} días). Por favor gestiona la renovación y envíanos la copia actualizada.`;
  }
  if (days === 0) {
    return `${capitalize(subject)} vence hoy (${date}). Por favor gestiona la renovación y envíanos la copia actualizada.`;
  }
  if (days < 0 && -days % 7 === 0) {
    return `${capitalize(subject)} venció el ${date} y sigue pendiente de renovación. Por favor envíanos la copia actualizada lo antes posible.`;
  }
  return null;
}

async function runExpiryAlerts(supabase: Supa, tenant: any, today: string) {
  let sent = 0;
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, status, truck_id, whatsapp_group_id, license_expiry, medical_card_expiry")
    .eq("tenant_id", tenant.id)
    .neq("status", "inactive");
  const driverList = (drivers as any[]) || [];

  for (const d of driverList) {
    if (!d.whatsapp_group_id) continue;
    for (const [field, label] of Object.entries(DRIVER_DOCS)) {
      const expiry = (d[field] || "").split("T")[0];
      if (!expiry) continue;
      const days = daysBetween(today, expiry);
      const text = expiryMessage(`${label} de ${d.name}`, expiry, days);
      if (text && await sendOnce(supabase, tenant.id, `expiry:driver:${d.id}:${field}:${expiry}:${days}`, d.whatsapp_group_id, text)) sent++;
    }
  }

  const { data: trucks } = await supabase
    .from("trucks")
    .select("id, unit_number, status, insurance_expiry, registration_expiry, annual_inspection_expiry")
    .eq("tenant_id", tenant.id)
    .neq("status", "inactive");

  for (const t of (trucks as any[]) || []) {
    const driver = driverList.find((d) => String(d.truck_id) === String(t.id) && d.whatsapp_group_id);
    if (!driver) continue;
    for (const [field, label] of Object.entries(TRUCK_DOCS)) {
      const expiry = (t[field] || "").split("T")[0];
      if (!expiry) continue;
      const days = daysBetween(today, expiry);
      const text = expiryMessage(`${label} del camión Unit #${t.unit_number}`, expiry, days);
      if (text && await sendOnce(supabase, tenant.id, `expiry:truck:${t.id}:${field}:${expiry}:${days}`, driver.whatsapp_group_id, text)) sent++;
    }
  }
  return { expiry_alerts: sent };
}

// ─── Reporte de administración ───────────────────────────────────────────────
async function buildAdminReport(supabase: Supa, tenant: any, today: string, stops: TodayStop[]): Promise<string> {
  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, driver_id, status, delivered_at")
    .eq("tenant_id", tenant.id)
    .neq("status", "cancelled");
  const all = (loads as any[]) || [];
  const active = all.filter((l) => !ACTIVE_EXCLUDED.includes(l.status));
  const unassigned = active.filter((l) => !l.driver_id);

  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const recentDelivered = all.filter((l) => l.status === "delivered" && l.delivered_at && l.delivered_at >= twoWeeksAgo);
  const missingPod: string[] = [];
  for (const l of recentDelivered) {
    if (!(await loadHasPod(supabase, l.id))) missingPod.push(`#${l.reference_number}`);
  }

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, status, truck_id, license_expiry, medical_card_expiry")
    .eq("tenant_id", tenant.id)
    .neq("status", "inactive");
  const driverList = (drivers as any[]) || [];
  const busy = new Set(active.map((l) => String(l.driver_id)));
  const idle = driverList.filter((d) => d.status === "available" && !busy.has(String(d.id))).map((d) => d.name);

  const { data: payments } = await supabase
    .from("payments").select("amount").eq("tenant_id", tenant.id).eq("status", "pending");
  const pendingTotal = ((payments as any[]) || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const { data: trucks } = await supabase
    .from("trucks")
    .select("id, unit_number, status, insurance_expiry, registration_expiry, annual_inspection_expiry")
    .eq("tenant_id", tenant.id)
    .neq("status", "inactive");
  const truckList = (trucks as any[]) || [];
  const unitOf = (id: string) => truckList.find((t) => String(t.id) === String(id))?.unit_number;

  const { data: maint } = await supabase
    .from("truck_maintenance").select("truck_id, maintenance_type").eq("tenant_id", tenant.id).eq("status", "due");
  const overdueMaint = ((maint as any[]) || []).map((m) => `Unit #${unitOf(m.truck_id) ?? "?"} ${m.maintenance_type}`);

  const expired: string[] = [];
  for (const d of driverList) {
    for (const [field, label] of Object.entries(DRIVER_DOCS)) {
      const e = (d[field] || "").split("T")[0];
      if (e && e < today) expired.push(`${capitalize(label.replace(/^la /, ""))} — ${d.name}`);
    }
  }
  for (const t of truckList) {
    for (const [field, label] of Object.entries(TRUCK_DOCS)) {
      const e = (t[field] || "").split("T")[0];
      if (e && e < today) expired.push(`${capitalize(label.replace(/^(el|la) /, ""))} — Unit #${t.unit_number}`);
    }
  }

  const list = (items: string[], max = 6) =>
    items.length === 0 ? "" : ` (${items.slice(0, max).join(", ")}${items.length > max ? `, +${items.length - max}` : ""})`;

  const pickups = stops.filter((s) => s.type === "pickup").length;
  const deliveries = stops.filter((s) => s.type === "delivery").length;

  return [
    `*Reporte diario — ${usDate(today)}*`,
    "",
    `Cargas activas: ${active.length}`,
    `Pickups hoy: ${pickups} · Entregas hoy: ${deliveries}`,
    `Cargas sin driver: ${unassigned.length}${list(unassigned.map((l) => `#${l.reference_number}`))}`,
    `Entregadas sin POD: ${missingPod.length}${list(missingPod)}`,
    `Drivers sin carga: ${idle.length}${list(idle)}`,
    `Pagos pendientes: ${(payments as any[] || []).length} por ${money(pendingTotal)}`,
    `Mantenimientos vencidos: ${overdueMaint.length}${list(overdueMaint, 4)}`,
    `Documentos vencidos: ${expired.length}${list(expired, 4)}`,
  ].join("\n");
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cron (todos los tenants) o usuario logueado (solo su tenant, para probar)
  const secret = Deno.env.get("CRON_SECRET");
  const fromCron = !!secret && req.headers.get("x-cron-secret") === secret;
  let userTenantId: string | null = null;
  if (!fromCron) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    userTenantId = profile?.tenant_id ?? null;
    if (!userTenantId) return json({ error: "No tenant" }, 403);
  }

  try {
    const { job } = await req.json().catch(() => ({}));
    const today = todayET();

    let q = supabase.from("tenants")
      .select("id, whatsapp_admin_group_id, wa_pod_reminders, wa_daily_reminders, wa_admin_report, wa_expiry_alerts");
    if (userTenantId) q = q.eq("id", userTenantId);
    const { data: tenants } = await q;

    const results: Record<string, unknown> = {};
    for (const tenant of (tenants as any[]) || []) {
      const r: Record<string, unknown> = {};

      if (job === "pod" && tenant.wa_pod_reminders) {
        Object.assign(r, await runPodReminders(supabase, tenant));
      }

      if (job === "daily") {
        const stops = await getTodayStops(supabase, tenant.id, today);
        if (tenant.wa_daily_reminders) Object.assign(r, await runDailyReminders(supabase, tenant, today, stops));
        if (tenant.wa_expiry_alerts) Object.assign(r, await runExpiryAlerts(supabase, tenant, today));
        if (tenant.wa_admin_report && tenant.whatsapp_admin_group_id) {
          const report = await buildAdminReport(supabase, tenant, today, stops);
          r.admin_report = await sendOnce(supabase, tenant.id, `admin:${tenant.id}:${today}`, tenant.whatsapp_admin_group_id, report);
        }
      }

      // Botón "Probar reporte": siempre se envía, sin registro de duplicados
      if (job === "admin_report_test" && userTenantId && tenant.whatsapp_admin_group_id) {
        const stops = await getTodayStops(supabase, tenant.id, today);
        await sendWhapiText(tenant.whatsapp_admin_group_id, await buildAdminReport(supabase, tenant, today, stops));
        r.admin_report_test = true;
      }

      results[tenant.id] = r;
    }

    console.log(`whatsapp-jobs ${job}:`, JSON.stringify(results));
    return json({ success: true, results });
  } catch (e) {
    console.error("whatsapp-jobs error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

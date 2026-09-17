// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadHasPod, cityState, timeWindow, todayET, usDate, sleep } from "../_shared/loadHelpers.ts";
import { logMessage, renderMessage, sendTextLogged, type MessageLog } from "../_shared/messaging.ts";

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

/** Envía una sola vez por clave (evita duplicados si el job corre dos veces) y registra en el historial */
async function sendOnce(supabase: Supa, key: string, log: MessageLog & { groupId: string; message: string }) {
  const { error: claimErr } = await supabase
    .from("whatsapp_message_log").insert({ tenant_id: log.tenantId, message_key: key });
  if (claimErr) return false;
  try {
    await sendTextLogged(supabase, log);
    await sleep(SEND_GAP_MS);
    return true;
  } catch (e) {
    await supabase.from("whatsapp_message_log").delete().eq("message_key", key);
    console.error(`Send failed (${key}):`, e);
    return false;
  }
}

// ─── POD ─────────────────────────────────────────────────────────────────────
async function runPodReminders(supabase: Supa, tenant: any) {
  const hour = etHour();
  if (hour < 7 || hour >= 21) return { pod_reminders: 0, pod_completed: 0, pod_outside_hours: true };

  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, driver_id, origin, destination, delivered_at, pod_reminder_count, pod_reminder_sent_at")
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
      .from("drivers").select("name, whatsapp_group_id").eq("id", load.driver_id).maybeSingle();
    if (!driver?.whatsapp_group_id) continue;

    const count = Number(load.pod_reminder_count) || 0;
    const message = await renderMessage(supabase, tenant.id, "pod_reminder", {
      carga: load.reference_number,
      driver: driver.name,
      ciudad_pickup: cityState(load.origin),
      ciudad_entrega: cityState(load.destination),
      recordatorio: count + 1,
    });
    const sent = await sendOnce(supabase, `pod:${load.id}:${load.delivered_at}:${count + 1}`, {
      tenantId: tenant.id, templateKey: "pod_reminder", recipientType: "driver", recipientName: driver.name,
      reference: `Carga #${load.reference_number}`, groupId: driver.whatsapp_group_id, message,
    });
    if (sent) {
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
  const stopList = (stops as any[]) || [];
  const loadsWithStops = new Set(stopList.map((s) => s.load_id));
  const byId = new Map(active.map((l) => [l.id, l]));

  // Primer pickup y última entrega de cada carga: si la parada no tiene fecha u hora
  // (el Rate Confirmation no las traía), usan las de la carga
  const firstPickup = new Map<string, number>();
  const lastDelivery = new Map<string, number>();
  for (const s of stopList) {
    const order = s.stop_order ?? 0;
    if (s.stop_type === "pickup" && order < (firstPickup.get(s.load_id) ?? Infinity)) firstPickup.set(s.load_id, order);
    if (s.stop_type === "delivery" && order > (lastDelivery.get(s.load_id) ?? -Infinity)) lastDelivery.set(s.load_id, order);
  }

  for (const s of stopList) {
    const l = byId.get(s.load_id);
    if (!l || s.arrived_at) continue;
    const order = s.stop_order ?? 0;
    const isFirstPickup = s.stop_type === "pickup" && firstPickup.get(s.load_id) === order;
    const isLastDelivery = s.stop_type === "delivery" && lastDelivery.get(s.load_id) === order;

    const date = (s.date
      || (isFirstPickup ? l.pickup_date : null)
      || (isLastDelivery ? l.delivery_date : null)
      || "").split("T")[0];
    if (date !== today) continue;

    const time = s.time
      || (isFirstPickup ? l.pickup_time : null)
      || (isLastDelivery ? l.delivery_time : null);

    result.push({ loadId: l.id, ref: l.reference_number, driverId: l.driver_id, loadStatus: l.status,
      type: s.stop_type, address: s.address, time, order });
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

async function dailyMessage(supabase: Supa, tenantId: string, items: TodayStop[], driverName: string): Promise<{ key: string; message: string }> {
  const names = { driver: driverName, nombre: driverName.trim().split(/\s+/)[0] || driverName };
  if (items.length === 1) {
    const s = items[0];
    const key = s.type === "pickup" ? "daily_pickup" : "daily_delivery";
    return {
      key,
      message: await renderMessage(supabase, tenantId, key, {
        ...names, carga: s.ref, ciudad: cityState(s.address), horario: timeWindow(s.time),
      }),
    };
  }
  const paradas = items
    .map((s) => `• ${s.type === "pickup" ? "Pickup" : "Entrega"} de la carga #${s.ref} en ${[cityState(s.address), timeWindow(s.time)].filter(Boolean).join(" ")}`)
    .join("\n");
  return { key: "daily_multiple", message: await renderMessage(supabase, tenantId, "daily_multiple", { ...names, paradas }) };
}

async function runDailyReminders(supabase: Supa, tenant: any, today: string, stops: TodayStop[]) {
  const byDriver = new Map<string, TodayStop[]>();
  const unassignedRefs = new Set<string>();
  for (const s of stops) {
    if (!s.driverId) { unassignedRefs.add(s.ref); continue; }
    if (!byDriver.has(s.driverId)) byDriver.set(s.driverId, []);
    byDriver.get(s.driverId)!.push(s);
  }

  // Dejar constancia en el historial de lo que no se pudo enviar
  for (const ref of unassignedRefs) {
    await logMessage(supabase, {
      tenantId: tenant.id, templateKey: "daily_pickup", reference: `Carga #${ref}`,
    }, "skipped", "La carga tiene parada hoy pero no tiene driver asignado");
  }

  let sent = 0;
  let noGroup = 0;
  for (const [driverId, items] of byDriver) {
    const { data: driver } = await supabase
      .from("drivers").select("name, whatsapp_group_id").eq("id", driverId).maybeSingle();
    if (!driver?.whatsapp_group_id) {
      noGroup++;
      await logMessage(supabase, {
        tenantId: tenant.id, templateKey: items.length > 1 ? "daily_multiple" : items[0].type === "pickup" ? "daily_pickup" : "daily_delivery",
        recipientType: "driver", recipientName: driver?.name ?? null, reference: items.map((s) => `#${s.ref}`).join(", "),
      }, "skipped", "El driver no tiene grupo de WhatsApp");
      continue;
    }
    items.sort((a, b) => (a.type === b.type ? a.order - b.order : a.type === "pickup" ? -1 : 1));
    const { key, message } = await dailyMessage(supabase, tenant.id, items, driver.name || "");
    const ok = await sendOnce(supabase, `daily:${driverId}:${today}`, {
      tenantId: tenant.id, templateKey: key, recipientType: "driver", recipientName: driver.name,
      reference: items.map((s) => `#${s.ref}`).join(", "), groupId: driver.whatsapp_group_id, message,
    });
    if (ok) sent++;
  }
  return {
    daily_reminders: sent,
    daily_drivers: byDriver.size,
    daily_no_group: noGroup,
    daily_unassigned: unassignedRefs.size,
  };
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

function expiryTemplateKey(days: number): string | null {
  if (days === 30 || days === 7) return "expiry_soon";
  if (days === 0) return "expiry_today";
  if (days < 0 && -days % 7 === 0) return "expiry_overdue";
  return null;
}

async function sendExpiry(
  supabase: Supa, tenantId: string, keyPrefix: string, subject: string, expiry: string,
  groupId: string, recipientName: string,
) {
  const days = daysBetween(todayET(), expiry);
  const templateKey = expiryTemplateKey(days);
  if (!templateKey) return false;
  const message = await renderMessage(supabase, tenantId, templateKey, {
    documento: subject, Documento: capitalize(subject), fecha: usDate(expiry), dias: Math.abs(days),
  });
  return sendOnce(supabase, `${keyPrefix}:${expiry}:${days}`, {
    tenantId, templateKey, recipientType: "driver", recipientName, reference: capitalize(subject), groupId, message,
  });
}

async function runExpiryAlerts(supabase: Supa, tenant: any) {
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
      if (expiry && await sendExpiry(supabase, tenant.id, `expiry:driver:${d.id}:${field}`, `${label} de ${d.name}`, expiry, d.whatsapp_group_id, d.name)) sent++;
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
      if (expiry && await sendExpiry(supabase, tenant.id, `expiry:truck:${t.id}:${field}`, `${label} del camión Unit #${t.unit_number}`, expiry, driver.whatsapp_group_id, driver.name)) sent++;
    }
  }
  return { expiry_alerts: sent };
}

// ─── Reporte de administración ───────────────────────────────────────────────
async function buildAdminReport(supabase: Supa, tenant: any, today: string, stops: TodayStop[]): Promise<string> {
  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, driver_id, status, delivered_at, pickup_date, total_rate")
    .eq("tenant_id", tenant.id)
    .neq("status", "cancelled");
  const all = (loads as any[]) || [];
  const active = all.filter((l) => !ACTIVE_EXCLUDED.includes(l.status));

  // Igual que "Week Revenue" del Dashboard: rate de las cargas no canceladas con pickup
  // en la semana actual completa (lunes a domingo)
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  const monday = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7))).toISOString().split("T")[0];
  const nextMonday = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7) + 7)).toISOString().split("T")[0];
  const weekBilled = all
    .filter((l) => {
      const p = (l.pickup_date || "").split("T")[0];
      return p && p >= monday && p < nextMonday;
    })
    .reduce((sum, l) => sum + (Number(l.total_rate) || 0), 0);

  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const recentDelivered = all.filter((l) => l.status === "delivered" && l.delivered_at && l.delivered_at >= twoWeeksAgo);
  const missingPod: string[] = [];
  for (const l of recentDelivered) {
    if (!(await loadHasPod(supabase, l.id))) missingPod.push(`#${l.reference_number}`);
  }

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, status")
    .eq("tenant_id", tenant.id)
    .neq("status", "inactive");
  const driverList = (drivers as any[]) || [];
  const busy = new Set(active.map((l) => String(l.driver_id)));
  const idle = driverList.filter((d) => d.status === "available" && !busy.has(String(d.id))).map((d) => d.name);

  const { data: payments } = await supabase
    .from("payments").select("amount").eq("tenant_id", tenant.id).eq("status", "pending");
  const paymentList = (payments as any[]) || [];
  const pendingTotal = paymentList.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const { data: trucks } = await supabase
    .from("trucks")
    .select("id, unit_number")
    .eq("tenant_id", tenant.id);
  const truckList = (trucks as any[]) || [];
  const unitOf = (id: string) => truckList.find((t) => String(t.id) === String(id))?.unit_number;

  const { data: maint } = await supabase
    .from("truck_maintenance").select("truck_id, maintenance_type").eq("tenant_id", tenant.id).eq("status", "due");
  const overdueMaint = ((maint as any[]) || []).map((m) => `Unit #${unitOf(m.truck_id) ?? "?"} ${m.maintenance_type}`);

  const list = (items: string[], max = 6) =>
    items.length === 0 ? "" : ` (${items.slice(0, max).join(", ")}${items.length > max ? `, +${items.length - max}` : ""})`;

  const pickups = stops.filter((s) => s.type === "pickup").length;
  const deliveries = stops.filter((s) => s.type === "delivery").length;

  return [
    `*Reporte diario — ${usDate(today)}*`,
    "",
    `Cargas activas: ${active.length}`,
    `Pickups hoy: ${pickups}`,
    `Entregas hoy: ${deliveries}`,
    `Entregadas sin POD: ${missingPod.length}${list(missingPod)}`,
    `Drivers sin carga: ${idle.length}${list(idle, 50)}`,
    `Pagos pendientes: ${paymentList.length} por ${money(pendingTotal)}`,
    `Mantenimientos vencidos: ${overdueMaint.length}${list(overdueMaint)}`,
    `Facturado esta semana: ${money(weekBilled)}`,
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

    let q = supabase.from("tenants").select("*");
    if (userTenantId) q = q.eq("id", userTenantId);
    const { data: tenants } = await q;

    const results: Record<string, unknown> = {};
    for (const tenant of (tenants as any[]) || []) {
      const r: Record<string, unknown> = {};
      const on = (toggle: string) => tenant[toggle] !== false;

      if (job === "pod" && fromCron && on("wa_pod_reminders")) {
        Object.assign(r, await runPodReminders(supabase, tenant));
      }

      // Botones "Enviar ahora": solo el tenant del usuario, sin restricción de hora.
      // Mantienen el control de duplicados, así que solo sale lo que no se había enviado.
      if (!fromCron && userTenantId) {
        if (job === "manual_daily_reminders") {
          const stops = await getTodayStops(supabase, tenant.id, today);
          Object.assign(r, await runDailyReminders(supabase, tenant, today, stops));
        }
        if (job === "manual_expiry") Object.assign(r, await runExpiryAlerts(supabase, tenant));
        if (job === "manual_pod") Object.assign(r, await runPodReminders(supabase, tenant));
      }

      // El cron corre en dos horas UTC; solo se envía cuando en Eastern es la hora correcta (cubre horario de verano e invierno)
      if (job === "daily" && fromCron && etHour() === 7) {
        const stops = await getTodayStops(supabase, tenant.id, today);
        if (on("wa_daily_reminders")) Object.assign(r, await runDailyReminders(supabase, tenant, today, stops));
        if (on("wa_expiry_alerts")) Object.assign(r, await runExpiryAlerts(supabase, tenant));
      }

      if (job === "admin_report" && fromCron && etHour() === 8) {
        if (on("wa_admin_report") && tenant.whatsapp_admin_group_id) {
          const stops = await getTodayStops(supabase, tenant.id, today);
          const message = await buildAdminReport(supabase, tenant, today, stops);
          r.admin_report = await sendOnce(supabase, `admin:${tenant.id}:${today}`, {
            tenantId: tenant.id, templateKey: "admin_report", recipientType: "admin",
            recipientName: tenant.whatsapp_admin_group_name ?? "Administración", reference: usDate(today),
            groupId: tenant.whatsapp_admin_group_id, message,
          });
        }
      }

      // Botón "Probar reporte": siempre se envía, sin registro de duplicados
      if (job === "admin_report_test" && userTenantId) {
        if (!tenant.whatsapp_admin_group_id) {
          await logMessage(supabase, { tenantId: tenant.id, templateKey: "admin_report", recipientType: "admin" }, "skipped", "No hay grupo de administración");
        } else {
          const stops = await getTodayStops(supabase, tenant.id, today);
          await sendTextLogged(supabase, {
            tenantId: tenant.id, templateKey: "admin_report", recipientType: "admin",
            recipientName: tenant.whatsapp_admin_group_name ?? "Administración", reference: `Prueba ${usDate(today)}`,
            groupId: tenant.whatsapp_admin_group_id, message: await buildAdminReport(supabase, tenant, today, stops),
          });
          r.admin_report_test = true;
        }
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

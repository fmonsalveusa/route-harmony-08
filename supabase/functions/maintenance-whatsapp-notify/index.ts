// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { todayET, usDate } from "../_shared/loadHelpers.ts";
import { isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";

// • Trigger de truck_maintenance (x-cron-secret): { maintenance_id, status }
// • Botón de la página Mantenimiento (admin): { all: true } → reenvía el aviso de todo lo pendiente
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Envía el aviso de un mantenimiento al grupo del Company Driver del camión */
async function notify(supabase: any, maintenanceId: string, status: string, claimDaily = false): Promise<Record<string, unknown>> {
  const { data: item } = await supabase
    .from("truck_maintenance")
    .select("id, tenant_id, truck_id, maintenance_type, interval_miles, miles_accumulated, next_due_date")
    .eq("id", maintenanceId)
    .maybeSingle();
  if (!item) return { skipped: "Maintenance not found" };
  if (!(await isEnabled(supabase, item.tenant_id, "wa_maintenance_alerts"))) return { skipped: "disabled" };

  const { data: truck } = await supabase
    .from("trucks").select("unit_number").eq("id", item.truck_id).maybeSingle();

  // Solo Company Drivers — el camión es de la empresa
  const { data: driver } = await supabase
    .from("drivers")
    .select("name, whatsapp_group_id")
    .eq("truck_id", item.truck_id)
    .eq("service_type", "company_driver")
    .limit(1)
    .maybeSingle();
  const unit = truck?.unit_number ? `Unit #${truck.unit_number}` : "asignado";
  if (!driver) return { unit, skipped: "no company driver" };

  const interval = Number(item.interval_miles) || 0;
  const miles = Math.round(Number(item.miles_accumulated) || 0);
  const byMiles = interval > 0 && miles / interval >= (status === "due" ? 1 : 0.8);

  const templateKey = byMiles || !item.next_due_date
    ? (status === "due" ? "maintenance_overdue" : "maintenance_approaching")
    : (status === "due" ? "maintenance_date_overdue" : "maintenance_date_approaching");

  const baseLog = {
    tenantId: item.tenant_id,
    templateKey,
    recipientType: "driver",
    recipientName: driver.name,
    reference: `${unit} · ${item.maintenance_type}`,
  };

  if (!driver.whatsapp_group_id) {
    await logMessage(supabase, baseLog, "skipped", "El driver no tiene grupo de WhatsApp");
    return { unit, driver: driver.name, skipped: "driver without whatsapp group" };
  }

  const message = await renderMessage(supabase, item.tenant_id, templateKey, {
    unidad: unit,
    mantenimiento: item.maintenance_type,
    driver: driver.name,
    millas: miles.toLocaleString("en-US"),
    intervalo: interval.toLocaleString("en-US"),
    fecha: item.next_due_date ? usDate(item.next_due_date) : "",
  });

  // En DUE el aviso se repite cada día (job diario): máximo uno por día por mantenimiento
  const dayKey = status === "due" && claimDaily ? `maintdue:${item.id}:${todayET()}` : null;
  if (dayKey) {
    const { error: claimErr } = await supabase
      .from("whatsapp_message_log").insert({ tenant_id: item.tenant_id, message_key: dayKey });
    if (claimErr) return { unit, driver: driver.name, skipped: "already notified today" };
  }
  try {
    await sendTextLogged(supabase, { ...baseLog, groupId: driver.whatsapp_group_id, message });
  } catch (e) {
    if (dayKey) await supabase.from("whatsapp_message_log").delete().eq("message_key", dayKey);
    throw e;
  }
  return { unit, driver: driver.name, sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const secret = Deno.env.get("CRON_SECRET");
    const fromCron = !!secret && req.headers.get("x-cron-secret") === secret;
    const body = await req.json().catch(() => ({}));

    if (fromCron) {
      const { maintenance_id, status } = body;
      if (!maintenance_id || !["warning", "due"].includes(status)) return json({ error: "Bad request" }, 400);
      return json(await notify(supabase, maintenance_id, status, true));
    }

    // Envío manual desde el TMS: solo admin, solo su tenant
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("tenant_id, is_master_admin").eq("id", user.id).maybeSingle(),
    ]);
    const isAdmin = profile?.is_master_admin || ((roles as any[]) || []).some((r) => ["admin", "master_admin"].includes(r.role));
    if (!isAdmin) return json({ error: "Solo un admin puede enviar los recordatorios" }, 403);
    if (!body.all) return json({ error: "Bad request" }, 400);

    const { data: pending } = await supabase
      .from("truck_maintenance").select("id, status")
      .eq("tenant_id", profile?.tenant_id).in("status", ["warning", "due"]);
    const results = [];
    for (const m of (pending as any[]) || []) {
      try { results.push(await notify(supabase, m.id, m.status)); }
      catch (e) { results.push({ error: e instanceof Error ? e.message : String(e) }); }
    }
    return json({ results });
  } catch (e) {
    console.error("maintenance-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

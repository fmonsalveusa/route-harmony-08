// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { usDate } from "../_shared/loadHelpers.ts";
import { isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";

// Llamada solo desde el trigger de truck_maintenance (autenticada con x-cron-secret)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { maintenance_id, status } = await req.json();
    if (!maintenance_id || !["warning", "due"].includes(status)) return json({ error: "Bad request" }, 400);

    const { data: item } = await supabase
      .from("truck_maintenance")
      .select("id, tenant_id, truck_id, maintenance_type, interval_miles, miles_accumulated, next_due_date")
      .eq("id", maintenance_id)
      .maybeSingle();
    if (!item) return json({ error: "Maintenance not found" }, 404);
    if (!(await isEnabled(supabase, item.tenant_id, "wa_maintenance_alerts"))) return json({ skipped: "disabled" });

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
    if (!driver) return json({ skipped: "no company driver" });

    const unit = truck?.unit_number ? `Unit #${truck.unit_number}` : "asignado";
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
      return json({ skipped: "driver without whatsapp group" });
    }

    const message = await renderMessage(supabase, item.tenant_id, templateKey, {
      unidad: unit,
      mantenimiento: item.maintenance_type,
      driver: driver.name,
      millas: miles.toLocaleString("en-US"),
      intervalo: interval.toLocaleString("en-US"),
      fecha: item.next_due_date ? usDate(item.next_due_date) : "",
    });

    await sendTextLogged(supabase, { ...baseLog, groupId: driver.whatsapp_group_id, message });
    return json({ success: true });
  } catch (e) {
    console.error("maintenance-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

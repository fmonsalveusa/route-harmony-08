import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhapiText } from "../_shared/whapi.ts";

// Llamada solo desde el trigger de truck_maintenance (autenticada con x-cron-secret)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const usDate = (d: string) => {
  const [y, m, day] = d.split("T")[0].split("-");
  return `${m}/${day}/${y}`;
};

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { maintenance_id, status } = await req.json();
    if (!maintenance_id || !["warning", "due"].includes(status)) return json({ error: "Bad request" }, 400);

    const { data: item } = await supabase
      .from("truck_maintenance")
      .select("id, truck_id, maintenance_type, interval_miles, miles_accumulated, next_due_date")
      .eq("id", maintenance_id)
      .maybeSingle();
    if (!item) return json({ error: "Maintenance not found" }, 404);

    const { data: truck } = await supabase
      .from("trucks").select("unit_number").eq("id", item.truck_id).maybeSingle();

    // Solo Company Drivers — el camión es de la empresa
    const { data: driver } = await supabase
      .from("drivers")
      .select("name, service_type, whatsapp_group_id")
      .eq("truck_id", item.truck_id)
      .eq("service_type", "company_driver")
      .not("whatsapp_group_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!driver?.whatsapp_group_id) return json({ skipped: "no company driver with whatsapp group" });

    const unit = truck?.unit_number ? `Unit #${truck.unit_number}` : "asignado";
    const type = item.maintenance_type;
    const interval = Number(item.interval_miles) || 0;
    const miles = Math.round(Number(item.miles_accumulated) || 0);
    const threshold = status === "due" ? 1 : 0.8;
    const byMiles = interval > 0 && miles / interval >= threshold;

    let text: string;
    if (byMiles) {
      text = status === "due"
        ? `El camión ${unit} completó ${interval.toLocaleString("en-US")} millas desde su último ${type}. Por favor coordina el mantenimiento.`
        : `El camión ${unit} lleva ${miles.toLocaleString("en-US")} de ${interval.toLocaleString("en-US")} millas desde su último ${type}. Por favor coordina el mantenimiento pronto.`;
    } else if (item.next_due_date) {
      text = status === "due"
        ? `El ${type} del camión ${unit} venció el ${usDate(item.next_due_date)}. Por favor coordina el mantenimiento.`
        : `El ${type} del camión ${unit} vence el ${usDate(item.next_due_date)}. Por favor coordina el mantenimiento pronto.`;
    } else {
      text = `El camión ${unit} necesita ${type}. Por favor coordina el mantenimiento.`;
    }

    await sendWhapiText(driver.whatsapp_group_id, text);
    console.log(`Maintenance ${status} sent: ${unit} ${type} → ${driver.name}`);
    return json({ success: true });
  } catch (e) {
    console.error("maintenance-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

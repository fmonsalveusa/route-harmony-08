import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadHasPod, cityState } from "../_shared/loadHelpers.ts";
import { isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";

// Llamada desde los triggers de loads / pod_documents y el job de POD (autenticada con x-cron-secret)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { load_id, event } = await req.json();
    if (!load_id || !["assigned", "delivered"].includes(event)) return json({ error: "Bad request" }, 400);

    const { data: load, error: loadErr } = await supabase
      .from("loads")
      .select("id, tenant_id, reference_number, driver_id, status, origin, destination, whatsapp_assigned_driver_id, whatsapp_delivered_sent_at")
      .eq("id", load_id)
      .maybeSingle();
    if (loadErr || !load) return json({ error: "Load not found" }, 404);
    if (!load.driver_id) return json({ skipped: "no driver" });

    const templateKey = event === "assigned" ? "load_assigned" : "load_delivered";
    const toggle = event === "assigned" ? "wa_load_assigned" : "wa_load_delivered";
    if (!(await isEnabled(supabase, load.tenant_id, toggle))) return json({ skipped: "disabled" });

    // Evita duplicados si el trigger se disparó más de una vez
    if (event === "assigned" && load.whatsapp_assigned_driver_id === String(load.driver_id)) {
      return json({ skipped: "already notified" });
    }
    if (event === "delivered" && (load.status !== "delivered" || load.whatsapp_delivered_sent_at)) {
      return json({ skipped: "not delivered or already notified" });
    }

    const { data: driver } = await supabase
      .from("drivers").select("name, whatsapp_group_id").eq("id", load.driver_id).maybeSingle();

    const baseLog = {
      tenantId: load.tenant_id,
      templateKey,
      recipientType: "driver",
      recipientName: driver?.name ?? null,
      reference: `Carga #${load.reference_number}`,
    };

    // "Completada" solo se anuncia cuando ya hay POD; si falta, el job de recordatorios lo pide
    if (event === "delivered" && !(await loadHasPod(supabase, load.id))) {
      return json({ skipped: "no POD yet" });
    }

    if (!driver?.whatsapp_group_id) {
      await logMessage(supabase, baseLog, "skipped", "El driver no tiene grupo de WhatsApp");
      return json({ skipped: "driver without whatsapp group" });
    }

    if (event === "delivered") {
      // Reservar el envío para que dos disparos simultáneos no manden el mensaje dos veces
      const { data: claimed } = await supabase
        .from("loads")
        .update({ whatsapp_delivered_sent_at: new Date().toISOString() })
        .eq("id", load.id)
        .is("whatsapp_delivered_sent_at", null)
        .select("id");
      if (!claimed || claimed.length === 0) return json({ skipped: "already notified" });
    }

    // Ciudades desde las paradas si existen; si no, origen/destino de la carga
    const { data: stops } = await supabase
      .from("load_stops").select("stop_type, address, stop_order").eq("load_id", load.id).order("stop_order");
    const stopList = (stops as any[]) || [];
    const pickup = stopList.find((s) => s.stop_type === "pickup")?.address ?? load.origin;
    const delivery = [...stopList].reverse().find((s) => s.stop_type === "delivery")?.address ?? load.destination;

    const message = await renderMessage(supabase, load.tenant_id, templateKey, {
      carga: load.reference_number,
      driver: driver.name,
      ciudad_pickup: cityState(pickup),
      ciudad_entrega: cityState(delivery),
    });

    try {
      await sendTextLogged(supabase, { ...baseLog, groupId: driver.whatsapp_group_id, message });
    } catch (sendErr) {
      if (event === "delivered") {
        await supabase.from("loads").update({ whatsapp_delivered_sent_at: null }).eq("id", load.id);
      }
      throw sendErr;
    }

    if (event === "assigned") {
      await supabase
        .from("loads")
        .update({ whatsapp_assigned_driver_id: String(load.driver_id), whatsapp_assigned_sent_at: new Date().toISOString() })
        .eq("id", load.id);
    }

    return json({ success: true });
  } catch (e) {
    console.error("load-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

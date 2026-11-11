import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadHasPod, cityState } from "../_shared/loadHelpers.ts";
import { isEnabled, logMessage, renderMessage, sendTextLogged } from "../_shared/messaging.ts";

// Llamada desde los triggers de loads / pod_documents y el job de POD (autenticada con x-cron-secret)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** BOL/POD en PDF subido a un pickup o a una entrega que no es la última: un mensaje por parada */
async function handleStopDocument(supabase: any, stopId: string) {
  const { data: stop } = await supabase
    .from("load_stops").select("id, load_id, stop_type, stop_order, address").eq("id", stopId).maybeSingle();
  if (!stop) return json({ skipped: "stop not found" });

  const { data: load } = await supabase
    .from("loads").select("id, tenant_id, reference_number, driver_id, status").eq("id", stop.load_id).maybeSingle();
  if (!load || !load.driver_id || load.status === "cancelled") return json({ skipped: "no load or driver" });
  if (!(await isEnabled(supabase, load.tenant_id, "wa_stop_docs"))) return json({ skipped: "disabled" });

  const order = stop.stop_order ?? 0;

  const templateKey = stop.stop_type === "pickup" ? "stop_docs_pickup" : "stop_docs_delivery";
  const { data: driver } = await supabase
    .from("drivers").select("name, whatsapp_group_id").eq("id", load.driver_id).maybeSingle();

  const baseLog = {
    tenantId: load.tenant_id,
    templateKey,
    recipientType: "driver",
    recipientName: driver?.name ?? null,
    reference: `Carga #${load.reference_number} · ${stop.stop_type === "pickup" ? "Pickup" : "Entrega"} ${cityState(stop.address)}`,
  };

  if (!driver?.whatsapp_group_id) {
    await logMessage(supabase, baseLog, "skipped", "El driver no tiene grupo de WhatsApp");
    return json({ skipped: "driver without whatsapp group" });
  }

  // Un solo mensaje por parada. La clave va por número de parada (no por id),
  // porque las paradas se recrean con ids nuevos al editar la carga.
  const key = `stopdocs:${load.id}:${stop.stop_type}:${order}`;
  const { error: claimErr } = await supabase
    .from("whatsapp_message_log").insert({ tenant_id: load.tenant_id, message_key: key });
  if (claimErr) return json({ skipped: "already notified" });

  const message = await renderMessage(supabase, load.tenant_id, templateKey, {
    nombre: (driver.name || "").trim().split(/\s+/)[0],
    driver: driver.name,
    carga: load.reference_number,
    ciudad: cityState(stop.address),
  });

  try {
    await sendTextLogged(supabase, { ...baseLog, groupId: driver.whatsapp_group_id, message });
  } catch (e) {
    await supabase.from("whatsapp_message_log").delete().eq("message_key", key);
    throw e;
  }
  return json({ success: true });
}

const AUTO_DISPATCH_DELAY_MS = 60_000;

/** El trigger de auto-dispatch deja una notificación "Auto-dispatch" de la carga al pasarla a Dispatched */
async function justAutoDispatched(supabase: any, loadId: string) {
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await supabase
    .from("notifications").select("id")
    .eq("load_id", loadId).eq("type", "status_changed").like("title", "Auto-dispatch%")
    .gte("created_at", since).limit(1);
  return !!data?.length;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { load_id, event, stop_id, deferred } = await req.json();
    if (event === "stop_document") {
      if (!stop_id) return json({ error: "Bad request" }, 400);
      return await handleStopDocument(supabase, stop_id);
    }
    if (!load_id || !["assigned", "delivered", "cancelled"].includes(event)) return json({ error: "Bad request" }, 400);

    // Carga que pasó sola a Dispatched al entregar la anterior: el aviso de la nueva carga va de último,
    // después de "completada" y del gracias por el POD, que salen en ese mismo momento
    if (event === "assigned" && !deferred && (await justAutoDispatched(supabase, load_id))) {
      // @ts-ignore EdgeRuntime existe en Supabase Edge Functions
      EdgeRuntime.waitUntil(
        new Promise((r) => setTimeout(r, AUTO_DISPATCH_DELAY_MS)).then(() =>
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/load-whatsapp-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-cron-secret": secret },
            body: JSON.stringify({ load_id, event, deferred: true }),
          })
        ).catch((e) => console.error("deferred assigned:", e)),
      );
      return json({ deferred: true });
    }

    const { data: load, error: loadErr } = await supabase
      .from("loads")
      .select("id, tenant_id, reference_number, driver_id, status, origin, destination, whatsapp_assigned_driver_id, whatsapp_delivered_sent_at, whatsapp_cancelled_sent_at, whatsapp_wait_rc")
      .eq("id", load_id)
      .maybeSingle();
    if (loadErr || !load) return json({ error: "Load not found" }, 404);
    if (!load.driver_id) return json({ skipped: "no driver" });

    const templateKey = event === "assigned" ? "load_assigned" : event === "cancelled" ? "load_cancelled" : "load_delivered";
    const toggle = event === "assigned" ? "wa_load_assigned" : event === "cancelled" ? "wa_load_cancelled" : "wa_load_delivered";
    if (!(await isEnabled(supabase, load.tenant_id, toggle))) return json({ skipped: "disabled" });

    // Evita duplicados si el trigger se disparó más de una vez
    if (event === "assigned" && load.whatsapp_assigned_driver_id === String(load.driver_id)) {
      return json({ skipped: "already notified" });
    }
    // "Crear y firmar RC": se avisa cuando el RC firmado sale al broker (lo libera broker-email)
    if (event === "assigned" && load.whatsapp_wait_rc) return json({ skipped: "waiting for signed RC" });
    // Mientras está en planned (o ya terminó) no se avisa; sale al pasar a dispatched
    if (event === "assigned" && ["planned", "cancelled", "delivered", "tonu", "paid"].includes(load.status)) {
      return json({ skipped: `status ${load.status}` });
    }
    // Cancelada: solo si a ese driver ya se le había avisado de la carga
    if (event === "cancelled") {
      if (load.status !== "cancelled" || load.whatsapp_cancelled_sent_at) return json({ skipped: "not cancelled or already notified" });
      if (load.whatsapp_assigned_driver_id !== String(load.driver_id)) return json({ skipped: "driver was never notified" });
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
    if (event === "cancelled") {
      await supabase.from("loads").update({ whatsapp_cancelled_sent_at: new Date().toISOString() }).eq("id", load.id);
    }

    return json({ success: true });
  } catch (e) {
    console.error("load-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

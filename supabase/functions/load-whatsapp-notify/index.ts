import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadHasPod } from "../_shared/loadHelpers.ts";

// Llamada solo desde el trigger de loads (autenticada con x-cron-secret)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sendToGroup(groupId: string, text: string) {
  const token = Deno.env.get("WHAPI_TOKEN");
  if (!token) throw new Error("WHAPI_TOKEN not configured");
  const res = await fetch("https://gate.whapi.cloud/messages/text", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: groupId, body: text }),
  });
  if (!res.ok) throw new Error(`Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { load_id, event } = await req.json();
    if (!load_id || !["assigned", "delivered"].includes(event)) return json({ error: "Bad request" }, 400);

    const { data: load, error: loadErr } = await supabase
      .from("loads")
      .select("id, reference_number, driver_id, status, whatsapp_assigned_driver_id, whatsapp_delivered_sent_at")
      .eq("id", load_id)
      .maybeSingle();
    if (loadErr || !load) return json({ error: "Load not found" }, 404);
    if (!load.driver_id) return json({ skipped: "no driver" });

    // Evita duplicados si el trigger se disparó más de una vez
    if (event === "assigned" && load.whatsapp_assigned_driver_id === String(load.driver_id)) {
      return json({ skipped: "already notified" });
    }
    if (event === "delivered" && (load.status !== "delivered" || load.whatsapp_delivered_sent_at)) {
      return json({ skipped: "not delivered or already notified" });
    }

    const { data: driver } = await supabase
      .from("drivers")
      .select("name, whatsapp_group_id")
      .eq("id", load.driver_id)
      .maybeSingle();
    if (!driver?.whatsapp_group_id) {
      console.log(`Driver ${load.driver_id} has no WhatsApp group — skipped load ${load.reference_number}`);
      return json({ skipped: "driver without whatsapp group" });
    }

    const ref = load.reference_number;

    // "Completada" solo se anuncia cuando ya hay POD; si falta, el job de recordatorios lo pide
    if (event === "delivered") {
      if (!(await loadHasPod(supabase, load.id))) return json({ skipped: "no POD yet" });
      // Reservar el envío para que dos disparos simultáneos no manden el mensaje dos veces
      const { data: claimed } = await supabase
        .from("loads")
        .update({ whatsapp_delivered_sent_at: new Date().toISOString() })
        .eq("id", load.id)
        .is("whatsapp_delivered_sent_at", null)
        .select("id");
      if (!claimed || claimed.length === 0) return json({ skipped: "already notified" });
    }

    const text = event === "assigned"
      ? `La carga #${ref} ha sido asignada a ti. Toda la información de la carga está en la app móvil.\nPor favor déjanos saber a qué hora estimas la llegada al Pick up.`
      : `La carga #${ref} ha sido completada exitosamente. Las fotos de la carga y el POD han sido recibidos.`;

    try {
      await sendToGroup(driver.whatsapp_group_id, text);
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

    console.log(`WhatsApp ${event} sent for load ${ref} to ${driver.name}`);
    return json({ success: true });
  } catch (e) {
    console.error("load-whatsapp-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

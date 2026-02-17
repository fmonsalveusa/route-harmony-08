import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all maintenance records
    const { data: maintenanceItems, error: mErr } = await supabase
      .from("truck_maintenance")
      .select("*");

    if (mErr) throw mErr;
    if (!maintenanceItems || maintenanceItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No maintenance records found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusOrder: Record<string, number> = { ok: 0, warning: 1, due: 2 };
    let updatedCount = 0;
    let notificationsCreated = 0;

    for (const item of maintenanceItems) {
      // Sum miles + empty_miles from loads since last_performed_at
      const { data: loads, error: lErr } = await supabase
        .from("loads")
        .select("miles, empty_miles")
        .eq("truck_id", item.truck_id)
        .gte("pickup_date", item.last_performed_at)
        .in("status", ["in_transit", "delivered", "paid"]);

      if (lErr) {
        console.error(`Error fetching loads for truck ${item.truck_id}:`, lErr);
        continue;
      }

      const milesAccumulated = (loads || []).reduce((sum: number, l: any) => {
        return sum + (Number(l.miles) || 0) + (Number(l.empty_miles) || 0);
      }, 0);

      // Calculate miles-based status
      let milesStatus = "ok";
      if (item.interval_miles && item.interval_miles > 0) {
        const pct = milesAccumulated / item.interval_miles;
        if (pct >= 1) milesStatus = "due";
        else if (pct >= 0.8) milesStatus = "warning";
      }

      // Calculate date-based status
      let dateStatus = "ok";
      if (item.next_due_date) {
        const dueDate = new Date(item.next_due_date);
        const now = new Date();
        const daysUntil = (dueDate.getTime() - now.getTime()) / 86400000;
        if (daysUntil <= 0) dateStatus = "due";
        else if (daysUntil <= 30) dateStatus = "warning";
      }

      // Take the worst status
      const finalStatus =
        (statusOrder[dateStatus] || 0) >= (statusOrder[milesStatus] || 0)
          ? dateStatus
          : milesStatus;

      const oldStatus = item.status || "ok";

      // Update miles_accumulated and status
      const { error: uErr } = await supabase
        .from("truck_maintenance")
        .update({ miles_accumulated: milesAccumulated, status: finalStatus })
        .eq("id", item.id);

      if (uErr) {
        console.error(`Error updating maintenance ${item.id}:`, uErr);
        continue;
      }
      updatedCount++;

      // Create notification only if status worsened
      const oldOrder = statusOrder[oldStatus] || 0;
      const newOrder = statusOrder[finalStatus] || 0;
      if (newOrder > oldOrder && (finalStatus === "warning" || finalStatus === "due")) {
        const label = finalStatus === "due" ? "⚠️ OVERDUE" : "⚡ Approaching";
        const { error: nErr } = await supabase.from("notifications").insert({
          tenant_id: item.tenant_id,
          title: `Maintenance ${label}`,
          message: `${item.maintenance_type} for truck is ${
            finalStatus === "due" ? "overdue" : "approaching due"
          }. ${milesAccumulated.toLocaleString()} mi accumulated.`,
          type: "maintenance",
        });

        if (nErr) {
          console.error(`Error creating notification:`, nErr);
        } else {
          notificationsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: updatedCount,
        notifications: notificationsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("maintenance-check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

async function sendWhatsApp(to: string, variables: Record<string, string>): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+15559269525";
  const contentSid = "HX73e0816a851fdc95ec6743003317b35a";

  if (!accountSid || !authToken) {
    console.error("Missing Twilio credentials");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:${to}`,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio error:", data);
    return false;
  }
  console.log("WhatsApp sent to", to, "SID:", data.sid);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { maintenanceType, status, milesAccumulated, truckId } = await req.json();

    if (!truckId || !maintenanceType || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("name, phone")
      .eq("truck_id", truckId)
      .not("phone", "is", null)
      .maybeSingle();

    if (driverError || !driver?.phone) {
      return new Response(JSON.stringify({ error: "Driver not found or no phone" }), { status: 404, headers: corsHeaders });
    }

    const phone = cleanPhone(driver.phone);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), { status: 400, headers: corsHeaders });
    }

    const { data: truck } = await supabase
      .from("trucks")
      .select("unit_number, make, model")
      .eq("id", truckId)
      .maybeSingle();

    const truckLabel = truck ? `Unit #${truck.unit_number} ${truck.make || ''} ${truck.model || ''}`.trim() : `Truck ID: ${truckId}`;

    const emoji = status === "due" ? "🔴" : "🟡";
    const statusLabel = status === "due" ? "VENCIDO" : "Proximo a Vencer";
    const estadoLabel = status === "due" ? "Vencido" : "Proximo a vencer";

    const variables: Record<string, string> = {
      "1": emoji,
      "2": statusLabel,
      "3": driver.name,
      "4": truckLabel,
      "5": maintenanceType,
      "6": estadoLabel,
      "7": milesAccumulated ? Number(milesAccumulated).toLocaleString() : "N/A",
    };

    const sent = await sendWhatsApp(phone, variables);

    return new Response(
      JSON.stringify({ success: sent, to: phone, driver: driver.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

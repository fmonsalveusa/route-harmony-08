import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { driver_name, phone, city, state, truck_type, meeting_date, meeting_time } = await req.json();

    // Validate required fields
    if (!driver_name || !phone || !city || !state || !truck_type || !meeting_date || !meeting_time) {
      throw new Error("Todos los campos son requeridos");
    }

    // Validate field lengths
    if (driver_name.length > 100) throw new Error("Nombre demasiado largo");
    if (phone.length > 20) throw new Error("Teléfono inválido");
    if (city.length > 100) throw new Error("Ciudad demasiado larga");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Insert into meeting_requests
    const { error: insertError } = await adminClient
      .from("meeting_requests")
      .insert({
        driver_name: driver_name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state,
        truck_type,
        meeting_date,
        meeting_time,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Error al guardar la solicitud");
    }

    // Send email notification
    const gmailUser = (Deno.env.get("GMAIL_USER") ?? "").trim();
    const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") ?? "").replace(/\s+/g, "").trim();

    if (!gmailUser || !gmailPass) {
      console.error("Missing Gmail credentials");
      // Still return success since the record was saved
      return new Response(JSON.stringify({ success: true, emailSent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPass },
      },
    });

    const formattedDate = new Date(meeting_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    await client.send({
      from: gmailUser,
      to: "agartransportation1@gmail.com",
      subject: `Nueva Solicitud de Reunión - ${driver_name}`,
      content: `Nueva solicitud de reunión:\n\nNombre: ${driver_name}\nTeléfono: ${phone}\nCiudad: ${city}, ${state}\nTipo de Vehículo: ${truck_type}\nFecha: ${formattedDate}\nHora: ${meeting_time}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
          <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="color:#ffffff;margin:0;font-size:22px">📅 Nueva Solicitud de Reunión</h1>
          </div>
          <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#374151;width:40%">👤 Nombre</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#111827">${driver_name}</td></tr>
              <tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#374151">📞 Teléfono</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#111827">${phone}</td></tr>
              <tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#374151">📍 Ubicación</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#111827">${city}, ${state}</td></tr>
              <tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#374151">🚛 Vehículo</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#111827">${truck_type}</td></tr>
              <tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#374151">📅 Fecha</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#111827">${formattedDate}</td></tr>
              <tr><td style="padding:10px 12px;font-weight:bold;color:#374151">🕐 Hora</td><td style="padding:10px 12px;color:#111827">${meeting_time}</td></tr>
            </table>
            <p style="margin-top:20px;color:#6b7280;font-size:13px;text-align:center">Este mensaje fue enviado automáticamente desde el formulario de la página web.</p>
          </div>
        </div>`,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, emailSent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-meeting-request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

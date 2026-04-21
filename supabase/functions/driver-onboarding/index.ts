import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formData = await req.formData();
    const token = formData.get("token") as string;
    const driverDataStr = formData.get("driver_data") as string;
    const truckDataStr = formData.get("truck_data") as string | null;

    if (!token || !driverDataStr) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from("onboarding_tokens")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await supabaseAdmin
        .from("onboarding_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRecord.id);
      return new Response(
        JSON.stringify({ error: "Token has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tokenRecord.tenant_id;
    const serviceType = tokenRecord.service_type || "owner_operator";
    const isOO = serviceType !== "company_driver";

    // Parse and validate JSON data
    let driverData: Record<string, unknown>;
    let truckData: Record<string, unknown> = {};
    try {
      driverData = JSON.parse(driverDataStr);
      if (truckDataStr) truckData = JSON.parse(truckDataStr);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in driver_data or truck_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required driver fields
    if (!driverData.name || !driverData.email || !driverData.phone || !driverData.license) {
      return new Response(
        JSON.stringify({ error: "Driver requires: name, email, phone, license" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required truck fields (only for OO)
    if (isOO && !truckData.unit_number) {
      return new Response(
        JSON.stringify({ error: "Truck requires: unit_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file uploads
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "webp"];
    // Collect all dynamic leasing keys (driver_leasing_<uuid>)
    const leasingFileKeys: string[] = [];
    for (const key of formData.keys()) {
      if (key.startsWith("driver_leasing_") && !["driver_leasing_agreement", "driver_leasing_agreement_venco", "driver_leasing_agreement_58"].includes(key)) {
        leasingFileKeys.push(key);
      }
    }

    const allFileKeys = [
      "driver_license_photo", "driver_medical_card_photo", "driver_form_w9",
      // Legacy fixed keys (backward compat)
      "driver_leasing_agreement", "driver_leasing_agreement_venco", "driver_leasing_agreement_58",
      "driver_service_agreement", "driver_employment_contract",
      ...leasingFileKeys,
      ...(isOO ? [
        "truck_registration_photo", "truck_insurance_photo", "truck_license_photo",
        "truck_rear_truck_photo", "truck_truck_side_photo", "truck_truck_plate_photo",
        "truck_cargo_area_photo",
      ] : []),
    ];
    for (const key of allFileKeys) {
      const file = formData.get(key) as File | null;
      if (file && file instanceof File) {
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: `File too large: ${file.name} (max 10MB)` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
          return new Response(
            JSON.stringify({ error: `Invalid file type: ${file.name} (allowed: ${ALLOWED_EXTENSIONS.join(", ")})` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Upload files helper
    const uploadFile = async (file: File, folder: string, name: string): Promise<string | null> => {
      if (!file || !(file instanceof File)) return null;
      const ext = file.name.split(".").pop() || "bin";
      const path = `${folder}/${name}.${ext}`;
      const { error } = await supabaseAdmin.storage
        .from("driver-documents")
        .upload(path, file, { upsert: true });
      if (error) {
        console.error(`Upload error for ${path}:`, error);
        return null;
      }
      return path;
    };

    // 1. Create truck (only for Owner Operator)
    let truckId: string | null = null;
    if (isOO) {
      const { data: newTruck, error: truckError } = await supabaseAdmin
        .from("trucks")
        .insert({
          tenant_id: tenantId,
          unit_number: truckData.unit_number,
          truck_type: truckData.truck_type || "Dry Van",
          make: truckData.make || null,
          model: truckData.model || null,
          year: truckData.year || null,
          max_payload_lbs: truckData.max_payload_lbs || null,
          vin: truckData.vin || null,
          license_plate: truckData.license_plate || null,
          status: "active",
          insurance_expiry: truckData.insurance_expiry || null,
          registration_expiry: truckData.registration_expiry || null,
          cargo_length_ft: truckData.cargo_length_ft || null,
          cargo_width_in: truckData.cargo_width_in || null,
          cargo_height_in: truckData.cargo_height_in || null,
          rear_door_width_in: truckData.rear_door_width_in || null,
          rear_door_height_in: truckData.rear_door_height_in || null,
          trailer_length_ft: truckData.trailer_length_ft || null,
          mega_ramp: truckData.mega_ramp || null,
        })
        .select("id")
        .single();

      if (truckError) {
        console.error("Truck creation error:", truckError);
        return new Response(
          JSON.stringify({ error: "Failed to create truck", detail: truckError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      truckId = newTruck.id;
    }

    // 2. Create driver
    const { data: newDriver, error: driverError } = await supabaseAdmin
      .from("drivers")
      .insert({
        tenant_id: tenantId,
        name: driverData.name,
        email: driverData.email,
        phone: driverData.phone,
        license: driverData.license,
        license_expiry: driverData.license_expiry || null,
        medical_card_expiry: driverData.medical_card_expiry || null,
        status: "pending",
        service_type: serviceType,
        dispatcher_id: tokenRecord.dispatcher_id || null,
        truck_id: truckId,
        hire_date: new Date().toISOString().split("T")[0],
        state: driverData.state || null,
        address: driverData.address || null,
        city: driverData.city || null,
        zip: driverData.zip || null,
        birthday: driverData.birthday || null,
        emergency_contact_name: driverData.emergency_contact_name || null,
        emergency_phone: driverData.emergency_phone || null,
      })
      .select("id")
      .single();

    if (driverError) {
      console.error("Driver creation error:", driverError);
      // Rollback truck if created
      if (truckId) await supabaseAdmin.from("trucks").delete().eq("id", truckId);
      return new Response(
        JSON.stringify({ error: "Failed to create driver", detail: driverError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driverId = newDriver.id;

    // Link truck to driver (only for OO)
    if (truckId) {
      await supabaseAdmin.from("trucks").update({ driver_id: driverId }).eq("id", truckId);
    }

    // 3. Upload driver documents
    const driverDocKeys = [
      "license_photo", "medical_card_photo", "form_w9",
      "service_agreement", "employment_contract",
    ];
    const driverDocUrls: Record<string, string> = {};
    for (const key of driverDocKeys) {
      const file = formData.get(`driver_${key}`) as File | null;
      if (file && file instanceof File) {
        const path = await uploadFile(file, driverId, key);
        if (path) driverDocUrls[`${key}_url`] = path;
      }
    }

    // Upload dynamic leasing agreement files (one per active company)
    const leasingInserts: Array<{ driver_id: string; company_id: string; company_name: string; file_url: string }> = [];
    for (const formKey of leasingFileKeys) {
      // formKey = "driver_leasing_<companyId>"
      const companyId = formKey.replace("driver_leasing_", "");
      const file = formData.get(formKey) as File | null;
      if (file && file instanceof File) {
        const path = await uploadFile(file, driverId, `leasing_${companyId}`);
        if (path) {
          // Fetch company name for the record
          const { data: co } = await supabaseAdmin
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .single();
          leasingInserts.push({
            driver_id: driverId,
            company_id: companyId,
            company_name: co?.name ?? companyId,
            file_url: path,
          });
        }
      }
    }
    if (leasingInserts.length > 0) {
      await supabaseAdmin.from("driver_leasing_agreements").insert(leasingInserts);
    }
    if (Object.keys(driverDocUrls).length > 0) {
      await supabaseAdmin.from("drivers").update(driverDocUrls).eq("id", driverId);
    }

    // 4. Upload truck documents (only for OO)
    if (isOO && truckId) {
      const truckDocKeys = ["registration_photo", "insurance_photo", "license_photo", "rear_truck_photo", "truck_side_photo", "truck_plate_photo", "cargo_area_photo"];
      const truckDocUrls: Record<string, string> = {};
      for (const key of truckDocKeys) {
        const file = formData.get(`truck_${key}`) as File | null;
        if (file && file instanceof File) {
          const path = await uploadFile(file, truckId, `truck_${key}`);
          if (path) truckDocUrls[`${key}_url`] = path;
        }
      }
      if (Object.keys(truckDocUrls).length > 0) {
        await supabaseAdmin.from("trucks").update(truckDocUrls).eq("id", truckId);
      }
    }

    // 4b. Create notification for admins
    const truckTypeLabel = isOO ? ((truckData.truck_type as string) || "Dry Van") : null;
    const serviceTypeLabel = isOO ? "Owner Operator" : "Company Driver";
    const notifMessage = isOO
      ? `${driverData.name} completó el onboarding · ${serviceTypeLabel} · ${truckTypeLabel}`
      : `${driverData.name} completó el onboarding · ${serviceTypeLabel}`;

    await supabaseAdmin.from("notifications").insert({
      tenant_id: tenantId,
      type: "new_driver_onboarded",
      title: "🚛 Nuevo Driver Registrado",
      message: notifMessage,
      driver_id: driverId,
    });

    // 5. Mark token as completed
    await supabaseAdmin
      .from("onboarding_tokens")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // 6. Send email notification to company
    try {
      // Get tenant info for company email
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name, email")
        .eq("id", tenantId)
        .single();

      const companyEmail = tenant?.email;
      const companyName = tenant?.name || "Your Company";
      const gmailUser = (Deno.env.get("GMAIL_USER") ?? "").trim();
      const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") ?? "").replace(/\s+/g, "").trim();

      if (companyEmail && gmailUser && gmailPass.length === 16) {
        const driverName = driverData.name as string;
        const driverEmail = driverData.email as string;
        const driverPhone = driverData.phone as string;
        const truckUnit = truckData.unit_number as string;
        const truckType = (truckData.truck_type as string) || "N/A";
        const truckMake = (truckData.make as string) || "";
        const truckModel = (truckData.model as string) || "";
        const truckYear = truckData.year ? String(truckData.year) : "";
        const truckVehicle = [truckYear, truckMake, truckModel].filter(Boolean).join(" ") || "N/A";

        const smtpClient = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: { username: gmailUser, password: gmailPass },
          },
        });

        await smtpClient.send({
          from: gmailUser,
          to: companyEmail,
          subject: `🚛 New Driver Onboarding Completed — ${driverName}`,
          content: `A new driver has completed the onboarding process.\n\nDriver: ${driverName}\nEmail: ${driverEmail}\nPhone: ${driverPhone}\nTruck: ${truckUnit} (${truckType}) — ${truckVehicle}\n\nThe driver status is set to PENDING. Please review and approve from the Drivers section.\n\n— ${companyName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#1e4078;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:18px">🚛 New Driver Onboarding Completed</h2>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
              <p style="margin:0 0 16px;color:#333">A new driver has completed the registration process and is awaiting your review.</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:35%">Driver Name</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${driverName}</td></tr>
                <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb">Email</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${driverEmail}</td></tr>
                <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb">Phone</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${driverPhone}</td></tr>
                <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb">Truck Unit</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${truckUnit} (${truckType})</td></tr>
                <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb">Vehicle</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${truckVehicle}</td></tr>
              </table>
              <div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:16px">
                <p style="margin:0;color:#92400e;font-size:14px"><strong>⚠️ Action Required:</strong> The driver status is <strong>PENDING</strong>. Please review and approve from the Drivers section.</p>
              </div>
              <p style="color:#9ca3af;font-size:12px;margin:0">— ${companyName}</p>
            </div>
          </div>`,
        });

        await smtpClient.close();
        console.log("Onboarding notification email sent to:", companyEmail);
      } else {
        console.log("Skipping email notification: missing company email or SMTP credentials");
      }
    } catch (emailErr) {
      // Don't fail the onboarding if email fails
      console.error("Failed to send onboarding notification email:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, driver_id: driverId, truck_id: truckId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Onboarding error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

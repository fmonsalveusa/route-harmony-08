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
    const secondDriverDataStr = formData.get("second_driver_data") as string | null;
    const isDriverOwnerStr = formData.get("is_driver_owner") as string | null;
    const isDriverOwner = isDriverOwnerStr ? JSON.parse(isDriverOwnerStr) : true;

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

    // Parse JSON data
    let driverData: Record<string, unknown>;
    let truckData: Record<string, unknown> = {};
    let secondDriverData: Record<string, unknown> | null = null;
    try {
      driverData = JSON.parse(driverDataStr);
      if (truckDataStr) truckData = JSON.parse(truckDataStr);
      if (secondDriverDataStr) secondDriverData = JSON.parse(secondDriverDataStr);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in form data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!driverData.name || !driverData.email || !driverData.phone) {
      return new Response(
        JSON.stringify({ error: "Owner/Driver requires: name, email, phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If OO is not the driver, validate second driver
    if (isOO && !isDriverOwner && secondDriverData) {
      if (!secondDriverData.name || !secondDriverData.email || !secondDriverData.phone || !secondDriverData.license) {
        return new Response(
          JSON.stringify({ error: "Driver requires: name, email, phone, license" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (isOO && !truckData.unit_number) {
      return new Response(
        JSON.stringify({ error: "Truck requires: unit_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect dynamic leasing file keys
    const leasingFileKeys: string[] = [];
    for (const key of formData.keys()) {
      if (key.startsWith("driver_leasing_") && !["driver_leasing_agreement", "driver_leasing_agreement_venco", "driver_leasing_agreement_58"].includes(key)) {
        leasingFileKeys.push(key);
      }
    }

    // Upload file helper
    const uploadFile = async (file: File, folder: string, name: string): Promise<string | null> => {
      if (!file || !(file instanceof File)) return null;
      const ext = file.name.split(".").pop() || "bin";
      const path = `${folder}/${name}.${ext}`;
      const { error } = await supabaseAdmin.storage
        .from("driver-documents")
        .upload(path, file, { upsert: true });
      if (error) { console.error(`Upload error for ${path}:`, error); return null; }
      return path;
    };

    // 1. Create truck
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
        return new Response(
          JSON.stringify({ error: "Failed to create truck", detail: truckError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      truckId = newTruck.id;
    }

    let driverId: string | null = null;
    let investorId: string | null = null;

    // ─── FLUJO A: OO es el driver (flujo normal) ─────────────────────────────
    if (!isOO || isDriverOwner) {
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
          bank_name: driverData.bank_name || null,
          account_holder_name: driverData.account_holder_name || null,
          routing_number: driverData.routing_number || null,
          account_number: driverData.account_number || null,
          account_type: driverData.account_type || "checking",
        })
        .select("id")
        .single();

      if (driverError) {
        if (truckId) await supabaseAdmin.from("trucks").delete().eq("id", truckId);
        return new Response(
          JSON.stringify({ error: "Failed to create driver", detail: driverError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      driverId = newDriver.id;
      if (truckId) await supabaseAdmin.from("trucks").update({ driver_id: driverId }).eq("id", truckId);

      // Upload driver documents
      const driverDocKeys = ["license_photo", "medical_card_photo", "form_w9", "service_agreement", "employment_contract"];
      const driverDocUrls: Record<string, string> = {};
      for (const key of driverDocKeys) {
        const file = formData.get(`driver_${key}`) as File | null;
        if (file && file instanceof File) {
          const path = await uploadFile(file, driverId, key);
          if (path) driverDocUrls[`${key}_url`] = path;
        }
      }

      // Dynamic leasing agreements
      const leasingInserts: Array<{ driver_id: string; company_id: string; company_name: string; file_url: string; tenant_id: string }> = [];
      for (const formKey of leasingFileKeys) {
        const companyId = formKey.replace("driver_leasing_", "");
        const file = formData.get(formKey) as File | null;
        if (file && file instanceof File) {
          const path = await uploadFile(file, driverId, `leasing_${companyId}`);
          if (path) {
            const { data: co } = await supabaseAdmin.from("companies").select("name").eq("id", companyId).single();
            leasingInserts.push({ driver_id: driverId, company_id: companyId, company_name: co?.name ?? companyId, file_url: path, tenant_id: tenantId });
          }
        }
      }
      if (leasingInserts.length > 0) await supabaseAdmin.from("driver_leasing_agreements").insert(leasingInserts);
      if (Object.keys(driverDocUrls).length > 0) await supabaseAdmin.from("drivers").update(driverDocUrls).eq("id", driverId);

    // ─── FLUJO B: OO NO es el driver ─────────────────────────────────────────
    } else if (isOO && !isDriverOwner) {

      // 2B. Crear el OO como Investor
      const { data: newInvestor, error: investorError } = await supabaseAdmin
        .from("investors")
        .insert({
          tenant_id: tenantId,
          name: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          address: driverData.address || null,
          city: driverData.city || null,
          state: driverData.state || null,
          zip: driverData.zip || null,
          bank_name: driverData.bank_name || null,
          account_holder_name: driverData.account_holder_name || null,
          routing_number: driverData.routing_number || null,
          account_number: driverData.account_number || null,
          account_type: driverData.account_type || "checking",
          pay_percentage: 0, // El dispatcher lo configura despues
        })
        .select("id")
        .single();

      if (investorError) {
        if (truckId) await supabaseAdmin.from("trucks").delete().eq("id", truckId);
        return new Response(
          JSON.stringify({ error: "Failed to create investor", detail: investorError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      investorId = newInvestor.id;

      // Upload documentos del OO/Investor (W9, service agreement, leasing)
      const investorDocUrls: Record<string, string> = {};

      const file_w9 = formData.get("driver_form_w9") as File | null;
      if (file_w9 instanceof File) {
        const path = await uploadFile(file_w9, `investors/${investorId}`, "w9");
        if (path) investorDocUrls["w9_url"] = path;
      }

      const file_service = formData.get("driver_service_agreement") as File | null;
      if (file_service instanceof File) {
        const path = await uploadFile(file_service, `investors/${investorId}`, "service_agreement");
        if (path) investorDocUrls["service_agreement_url"] = path;
      }

      // Leasing agreements van al investor
      for (const formKey of leasingFileKeys) {
        const file = formData.get(formKey) as File | null;
        if (file instanceof File) {
          const path = await uploadFile(file, `investors/${investorId}`, `leasing_${formKey.replace("driver_leasing_", "")}`);
          if (path) investorDocUrls["leasing_agreement_url"] = path;
        }
      }

      if (Object.keys(investorDocUrls).length > 0) {
        await supabaseAdmin.from("investors").update(investorDocUrls).eq("id", investorId);
      }

      // 3B. Crear el driver (la persona que maneja)
      if (secondDriverData) {
        const { data: newDriver, error: driverError } = await supabaseAdmin
          .from("drivers")
          .insert({
            tenant_id: tenantId,
            name: secondDriverData.name,
            email: secondDriverData.email,
            phone: secondDriverData.phone,
            license: secondDriverData.license,
            license_expiry: secondDriverData.license_expiry || null,
            medical_card_expiry: secondDriverData.medical_card_expiry || null,
            status: "pending",
            service_type: "owner_operator", // Trabaja para el OO
            dispatcher_id: tokenRecord.dispatcher_id || null,
            truck_id: truckId,
            hire_date: new Date().toISOString().split("T")[0],
            state: secondDriverData.state || null,
            birthday: secondDriverData.birthday || null,
            emergency_contact_name: secondDriverData.emergency_contact_name || null,
            emergency_phone: secondDriverData.emergency_phone || null,
            // Investor asignado = el OO
            investor_id: investorId,
            investor_name: driverData.name as string,
            investor_email: driverData.email as string,
          })
          .select("id")
          .single();

        if (driverError) {
          return new Response(
            JSON.stringify({ error: "Failed to create driver", detail: driverError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        driverId = newDriver.id;
        if (truckId) await supabaseAdmin.from("trucks").update({ driver_id: driverId }).eq("id", truckId);

        // Upload documentos del driver
        const driverDocKeys = ["license_photo", "medical_card_photo"];
        const driverDocUrls: Record<string, string> = {};
        for (const key of driverDocKeys) {
          const file = formData.get(`second_driver_${key}`) as File | null;
          if (file instanceof File) {
            const path = await uploadFile(file, driverId, key);
            if (path) driverDocUrls[`${key}_url`] = path;
          }
        }
        if (Object.keys(driverDocUrls).length > 0) {
          await supabaseAdmin.from("drivers").update(driverDocUrls).eq("id", driverId);
        }

        // Agregar OO como investor en driver_investors
        await supabaseAdmin.from("driver_investors").insert({
          driver_id: driverId,
          investor_id: investorId,
          investor_name: driverData.name as string,
          investor_email: driverData.email as string | null,
          pay_percentage: 0, // El dispatcher configura el % despues
          tenant_id: tenantId,
        });
      }
    }

    // 4. Upload truck documents
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

    // 5. Notification
    const notifMessage = isOO && !isDriverOwner
      ? `${driverData.name} (Owner) + ${secondDriverData?.name ?? "Driver"} completaron el onboarding · Owner Operator`
      : `${driverData.name} completó el onboarding · ${isOO ? "Owner Operator" : "Company Driver"}`;

    await supabaseAdmin.from("notifications").insert({
      tenant_id: tenantId,
      type: "new_driver_onboarded",
      title: "🚛 Nuevo Driver Registrado",
      message: notifMessage,
      driver_id: driverId,
    });

    // 6. Mark token completed
    await supabaseAdmin
      .from("onboarding_tokens")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // 7. Email notification
    try {
      const { data: tenant } = await supabaseAdmin.from("tenants").select("name, email").eq("id", tenantId).single();
      const companyEmail = tenant?.email;
      const companyName = tenant?.name || "Your Company";
      const gmailUser = (Deno.env.get("GMAIL_USER") ?? "").trim();
      const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") ?? "").replace(/\s+/g, "").trim();

      if (companyEmail && gmailUser && gmailPass.length === 16) {
        const smtpClient = new SMTPClient({
          connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
        });

        const subject = isOO && !isDriverOwner
          ? `🚛 New Owner Operator Onboarded – ${driverData.name}`
          : `🚛 New Driver Onboarding Completed – ${driverData.name}`;

        const textBody = isOO && !isDriverOwner
          ? `Owner: ${driverData.name} (${driverData.email})\nDriver: ${secondDriverData?.name ?? "—"}\nTruck: ${truckData.unit_number}\n\nReview from the Investors and Drivers sections.`
          : `Driver: ${driverData.name} (${driverData.email})\nPhone: ${driverData.phone}\nTruck: ${truckData.unit_number}\n\nReview from the Drivers section.`;

        await smtpClient.send({ from: gmailUser, to: companyEmail, subject, content: textBody });
        await smtpClient.close();
      }
    } catch (emailErr) {
      console.error("Failed to send email:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, driver_id: driverId, truck_id: truckId, investor_id: investorId }),
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

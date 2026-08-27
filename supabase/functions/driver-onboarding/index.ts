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

    // Solo el token es obligatorio globalmente. driver_data solo aplica al flow OO/CD
    // (dispatch_service usa drivers_data plural — se valida dentro de su propio bloque).
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
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

    // ═══════════════════════════════════════════════════════════════════
    // FLUJO ADD DRIVER a OO EXISTENTE
    // Detecta si el token trae existing_investor_id + existing_truck_id.
    // Solo crea el driver, vinculado al investor y truck ya existentes.
    // ═══════════════════════════════════════════════════════════════════
    if (tokenRecord.existing_investor_id && tokenRecord.existing_truck_id) {
      const driverDataStrAdd = formData.get("driver_data") as string;
      if (!driverDataStrAdd) {
        return new Response(JSON.stringify({ error: "Missing driver_data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let dData: any;
      try { dData = JSON.parse(driverDataStrAdd); }
      catch { return new Response(JSON.stringify({ error: "Invalid driver_data JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      if (!dData.name || !dData.email || !dData.phone || !dData.license) {
        return new Response(JSON.stringify({ error: "Driver requires: name, email, phone, license" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Traer info del investor existente para propagarla al driver
      const { data: investor } = await supabaseAdmin
        .from("investors")
        .select("id, name, email")
        .eq("id", tokenRecord.existing_investor_id)
        .single();

      // Crear driver vinculado al investor + truck ya existentes
      const { data: newDriver, error: driverErr } = await supabaseAdmin
        .from("drivers")
        .insert({
          tenant_id: tenantId,
          name: dData.name,
          email: dData.email,
          phone: dData.phone,
          license: dData.license,
          license_expiry: dData.license_expiry || null,
          medical_card_expiry: dData.medical_card_expiry || null,
          status: "pending",
          service_type: "owner_operator",
          dispatcher_id: tokenRecord.dispatcher_id || null,
          truck_id: tokenRecord.existing_truck_id,
          hire_date: new Date().toISOString().split("T")[0],
          state: dData.state || null,
          address: dData.address || null,
          city: dData.city || null,
          zip: dData.zip || null,
          birthday: dData.birthday || null,
          emergency_contact_name: dData.emergency_contact_name || null,
          emergency_phone: dData.emergency_phone || null,
          investor_id: tokenRecord.existing_investor_id,
          investor_name: investor?.name || null,
          investor_email: investor?.email || null,
        })
        .select("id")
        .single();
      if (driverErr || !newDriver) {
        console.error("[AddDriver] Driver create error:", driverErr);
        return new Response(JSON.stringify({ error: "Failed to create driver", detail: driverErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const driverId = newDriver.id;

      // Helper upload
      const uploadDriverFile = async (file: File, name: string): Promise<string | null> => {
        if (!file || !(file instanceof File)) return null;
        const ext = file.name.split(".").pop() || "bin";
        const path = `${driverId}/${name}.${ext}`;
        const { error } = await supabaseAdmin.storage.from("driver-documents").upload(path, file, { upsert: true });
        if (error) { console.error(`[AddDriver] Upload ${path}:`, error); return null; }
        return path;
      };

      const licPhoto = formData.get("driver_license_photo") as File | null;
      const medPhoto = formData.get("driver_medical_card_photo") as File | null;
      const updates: Record<string, string> = {};
      if (licPhoto instanceof File) {
        const url = await uploadDriverFile(licPhoto, "license_photo");
        if (url) updates.license_photo_url = url;
      }
      if (medPhoto instanceof File) {
        const url = await uploadDriverFile(medPhoto, "medical_card_photo");
        if (url) updates.medical_card_photo_url = url;
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("drivers").update(updates).eq("id", driverId);
      }

      // Marcar token como completed
      await supabaseAdmin.from("onboarding_tokens").update({ status: "completed" }).eq("id", tokenRecord.id);

      return new Response(JSON.stringify({
        success: true,
        driver_id: driverId,
        investor_id: tokenRecord.existing_investor_id,
        truck_id: tokenRecord.existing_truck_id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ═══════════════════════════════════════════════════════════════════
    // FIN FLUJO ADD DRIVER
    // ═══════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════
    // FLUJO DISPATCH SERVICE (separado del flow OO/CD para no interferir)
    // ═══════════════════════════════════════════════════════════════════
    if (serviceType === "dispatch_service") {
      const isExistingCompanyStr = formData.get("is_existing_company") as string | null;
      const isExistingCompany = isExistingCompanyStr ? JSON.parse(isExistingCompanyStr) : false;

      const driversDataStr = formData.get("drivers_data") as string;
      if (!driversDataStr) {
        return new Response(JSON.stringify({ error: "Missing drivers_data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let driversArr: any[];
      try { driversArr = JSON.parse(driversDataStr); }
      catch { return new Response(JSON.stringify({ error: "Invalid drivers_data JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      if (!Array.isArray(driversArr) || driversArr.length === 0) {
        return new Response(JSON.stringify({ error: "At least one driver required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Helper upload local
      const uploadDs = async (file: File, folder: string, name: string): Promise<string | null> => {
        if (!file || !(file instanceof File)) return null;
        const ext = file.name.split(".").pop() || "bin";
        const path = `${folder}/${name}.${ext}`;
        const { error } = await supabaseAdmin.storage.from("driver-documents").upload(path, file, { upsert: true });
        if (error) { console.error(`[DS] Upload error ${path}:`, error); return null; }
        return path;
      };

      let clientId: string | null = tokenRecord.dispatch_service_client_id || null;

      // ─── Empresa NUEVA: crear cliente + subir docs + guardar firma ───
      if (!isExistingCompany) {
        const companyDataStr = formData.get("company_data") as string;
        if (!companyDataStr) {
          return new Response(JSON.stringify({ error: "Missing company_data for new company" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const factoringDataStr = formData.get("factoring_data") as string | null;
        const insuranceDataStr = formData.get("insurance_data") as string | null;
        const signerName = (formData.get("signer_name") as string) || "";
        const agreementSignature = formData.get("agreement_signature") as string | null;

        let companyData: any = {};
        try { companyData = JSON.parse(companyDataStr); }
        catch { return new Response(JSON.stringify({ error: "Invalid company_data JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        if (!companyData.legal_business_name) {
          return new Response(JSON.stringify({ error: "legal_business_name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const factoringData = factoringDataStr ? JSON.parse(factoringDataStr) : {};
        const insuranceData = insuranceDataStr ? JSON.parse(insuranceDataStr) : {};

        const { data: newClient, error: clientError } = await supabaseAdmin
          .from("dispatch_service_clients")
          .insert({
            tenant_id: tenantId,
            legal_business_name: companyData.legal_business_name,
            dba: companyData.dba || null,
            mc_number: companyData.mc_number || null,
            dot_number: companyData.dot_number || null,
            ein: companyData.ein || null,
            address: companyData.address || null,
            city: companyData.city || null,
            state: companyData.state || null,
            zip: companyData.zip || null,
            phone: companyData.phone || null,
            email: companyData.email || null,
            email_password: companyData.email_password || null,
            owner_full_name: companyData.owner_full_name || signerName || null,
            factoring_company_name: factoringData.factoring_company_name || null,
            factoring_username: factoringData.factoring_username || null,
            factoring_password: factoringData.factoring_password || null,
            insurance_company_name: insuranceData.insurance_company_name || null,
            insurance_policy_number: insuranceData.insurance_policy_number || null,
            insurance_expiry_date: insuranceData.insurance_expiry_date || null,
            agreement_signed_at: agreementSignature ? new Date().toISOString() : null,
          })
          .select("id")
          .single();
        if (clientError || !newClient) {
          console.error("[DS] Client create error:", clientError);
          return new Response(JSON.stringify({ error: "Failed to create dispatch service client", detail: clientError?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        clientId = newClient.id;

        // Docs de la empresa
        const mcFile = formData.get("company_mc_authority") as File | null;
        const insFile = formData.get("company_insurance_cert") as File | null;
        const w9File = formData.get("company_w9") as File | null;
        const noaFile = formData.get("company_noa") as File | null;
        const mcUrl = mcFile ? await uploadDs(mcFile, `dispatch_clients/${clientId}`, "mc_authority") : null;
        const insUrl = insFile ? await uploadDs(insFile, `dispatch_clients/${clientId}`, "insurance_cert") : null;
        const w9Url = w9File ? await uploadDs(w9File, `dispatch_clients/${clientId}`, "w9") : null;
        const noaUrl = noaFile ? await uploadDs(noaFile, `dispatch_clients/${clientId}`, "noa") : null;

        // PDF del agreement firmado (generado client-side) — es el documento legal principal.
        const agreementPdfFile = formData.get("company_agreement_pdf") as File | null;
        let agreementPdfUrl: string | null = null;
        if (agreementPdfFile instanceof File) {
          agreementPdfUrl = await uploadDs(agreementPdfFile, `dispatch_clients/${clientId}`, "agreement_signed");
        }

        // Firma standalone (PNG) — guardada aparte por si se necesita re-generar el PDF a futuro.
        let signatureUrl: string | null = null;
        if (agreementSignature && agreementSignature.startsWith("data:image/")) {
          try {
            const base64 = agreementSignature.split(",")[1];
            const bin = atob(base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const sigFile = new File([bytes], "signature.png", { type: "image/png" });
            signatureUrl = await uploadDs(sigFile, `dispatch_clients/${clientId}`, "signature");
          } catch (e) { console.error("[DS] Signature upload error:", e); }
        }

        // Update URLs en el client
        await supabaseAdmin
          .from("dispatch_service_clients")
          .update({
            mc_authority_url: mcUrl,
            insurance_cert_url: insUrl,
            w9_url: w9Url,
            noa_url: noaUrl,
            dispatch_service_agreement_url: agreementPdfUrl, // PDF final firmado
          })
          .eq("id", clientId);
      }

      if (!clientId) {
        return new Response(JSON.stringify({ error: "No dispatch service client resolved" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ─── Crear drivers + trucks ───
      const createdDrivers: Array<{ id: string; name: string }> = [];
      const createdTrucks: Array<{ id: string; unit_number: string }> = [];

      for (let i = 0; i < driversArr.length; i++) {
        const d = driversArr[i];
        if (!d.name || !d.email || !d.phone || !d.license) {
          return new Response(JSON.stringify({ error: `Driver ${i + 1}: name, email, phone, license required` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!d.truck?.unit_number) {
          return new Response(JSON.stringify({ error: `Driver ${i + 1}: truck unit_number required` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Crear truck
        const { data: newTruck, error: truckErr } = await supabaseAdmin
          .from("trucks")
          .insert({
            tenant_id: tenantId,
            unit_number: d.truck.unit_number,
            truck_type: d.truck.truck_type || "Box Truck",
            make: d.truck.make || null,
            model: d.truck.model || null,
            year: d.truck.year || null,
            vin: d.truck.vin || null,
            license_plate: d.truck.license_plate || null,
            insurance_expiry: d.truck.insurance_expiry || null,
            registration_expiry: d.truck.registration_expiry || null,
            status: "active",
          })
          .select("id")
          .single();
        if (truckErr || !newTruck) {
          console.error(`[DS] Truck ${i} error:`, truckErr);
          return new Response(JSON.stringify({ error: `Failed to create truck for driver ${i + 1}`, detail: truckErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const truckId = newTruck.id;

        // Crear driver
        const { data: newDriver, error: driverErr } = await supabaseAdmin
          .from("drivers")
          .insert({
            tenant_id: tenantId,
            name: d.name,
            email: d.email,
            phone: d.phone,
            license: d.license,
            license_expiry: d.license_expiry || null,
            medical_card_expiry: d.medical_card_expiry || null,
            status: "pending",
            service_type: "dispatch_service",
            dispatch_service_client_id: clientId,
            dispatcher_id: tokenRecord.dispatcher_id || null,
            truck_id: truckId,
            hire_date: new Date().toISOString().split("T")[0],
            state: d.state || null,
            address: d.address || null,
            city: d.city || null,
            zip: d.zip || null,
            birthday: d.birthday || null,
            emergency_contact_name: d.emergency_contact_name || null,
            emergency_phone: d.emergency_phone || null,
            bank_name: d.bank_name || null,
            account_holder_name: d.account_holder_name || null,
            routing_number: d.routing_number || null,
            account_number: d.account_number || null,
            account_type: d.account_type || "checking",
          })
          .select("id")
          .single();
        if (driverErr || !newDriver) {
          console.error(`[DS] Driver ${i} error:`, driverErr);
          // Cleanup truck creado
          await supabaseAdmin.from("trucks").delete().eq("id", truckId);
          return new Response(JSON.stringify({ error: `Failed to create driver ${i + 1}`, detail: driverErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const driverId = newDriver.id;
        // Vincular truck.driver_id
        await supabaseAdmin.from("trucks").update({ driver_id: driverId }).eq("id", truckId);

        // Subir docs del driver
        const driverUpdates: Record<string, string> = {};
        const licPhoto = formData.get(`driver_${i}_license_photo`) as File | null;
        const medPhoto = formData.get(`driver_${i}_medical_card_photo`) as File | null;
        if (licPhoto instanceof File) {
          const url = await uploadDs(licPhoto, driverId, "license_photo");
          if (url) driverUpdates.license_photo_url = url;
        }
        if (medPhoto instanceof File) {
          const url = await uploadDs(medPhoto, driverId, "medical_card_photo");
          if (url) driverUpdates.medical_card_photo_url = url;
        }
        if (Object.keys(driverUpdates).length > 0) {
          await supabaseAdmin.from("drivers").update(driverUpdates).eq("id", driverId);
        }

        // Subir docs del truck
        const truckDocMap: Array<[string, string]> = [
          ["truck_registration", "registration_photo_url"],
          ["truck_insurance", "insurance_photo_url"],
          ["truck_plate_photo", "truck_plate_photo_url"],
          ["truck_side_photo", "truck_side_photo_url"],
          ["truck_rear_photo", "rear_truck_photo_url"],
          ["cargo_area_photo", "cargo_area_photo_url"],
        ];
        const truckUpdates: Record<string, string> = {};
        for (const [formKey, dbCol] of truckDocMap) {
          const f = formData.get(`driver_${i}_${formKey}`) as File | null;
          if (f instanceof File) {
            const url = await uploadDs(f, `trucks/${truckId}`, formKey);
            if (url) truckUpdates[dbCol] = url;
          }
        }
        if (Object.keys(truckUpdates).length > 0) {
          await supabaseAdmin.from("trucks").update(truckUpdates).eq("id", truckId);
        }

        createdDrivers.push({ id: driverId, name: d.name });
        createdTrucks.push({ id: truckId, unit_number: d.truck.unit_number });
      }

      // Marcar token como completado
      await supabaseAdmin
        .from("onboarding_tokens")
        .update({ status: "completed" })
        .eq("id", tokenRecord.id);

      return new Response(JSON.stringify({
        success: true,
        dispatch_service_client_id: clientId,
        drivers_created: createdDrivers.length,
        drivers: createdDrivers,
        trucks: createdTrucks,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ═══════════════════════════════════════════════════════════════════
    // FIN FLUJO DISPATCH SERVICE
    // ═══════════════════════════════════════════════════════════════════

    // Para el flow OO/CD (no dispatch_service), driver_data es requerido
    if (!driverDataStr) {
      return new Response(
        JSON.stringify({ error: "Missing driver_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      // Mapeo de companyId → columna en la tabla drivers para que el perfil muestre los leasing
      const LEASING_COLUMN_MAP: Record<string, string> = {
        "789196fd-825a-45ea-b9e2-6da6bc189b10": "leasing_agreement_url",     // AG-AR
        "21f1d144-908f-4b6b-85e6-1e15e33ac0a3": "leasing_agreement_58_url",  // 58 Logistics
      };
      for (const formKey of leasingFileKeys) {
        const companyId = formKey.replace("driver_leasing_", "");
        const file = formData.get(formKey) as File | null;
        if (file && file instanceof File) {
          const path = await uploadFile(file, driverId, `leasing_${companyId}`);
          if (path) {
            const { data: co } = await supabaseAdmin.from("companies").select("name").eq("id", companyId).single();
            leasingInserts.push({ driver_id: driverId, company_id: companyId, company_name: co?.name ?? companyId, file_url: path, tenant_id: tenantId });
            // También guardar el path en la columna de drivers para que el perfil lo muestre
            const col = LEASING_COLUMN_MAP[companyId];
            if (col) driverDocUrls[col] = path;
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const truckDataStr = formData.get("truck_data") as string;

    if (!token || !driverDataStr || !truckDataStr) {
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
    const driverData = JSON.parse(driverDataStr);
    const truckData = JSON.parse(truckDataStr);

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

    // 1. Create truck
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

    const truckId = newTruck.id;

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
        status: "available",
        service_type: "owner_operator",
        dispatcher_id: tokenRecord.dispatcher_id || null,
        truck_id: truckId,
        hire_date: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single();

    if (driverError) {
      console.error("Driver creation error:", driverError);
      // Rollback truck
      await supabaseAdmin.from("trucks").delete().eq("id", truckId);
      return new Response(
        JSON.stringify({ error: "Failed to create driver", detail: driverError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driverId = newDriver.id;

    // Link truck to driver
    await supabaseAdmin.from("trucks").update({ driver_id: driverId }).eq("id", truckId);

    // 3. Upload driver documents
    const driverDocKeys = ["license_photo", "medical_card_photo", "form_w9", "leasing_agreement", "service_agreement"];
    const driverDocUrls: Record<string, string> = {};
    for (const key of driverDocKeys) {
      const file = formData.get(`driver_${key}`) as File | null;
      if (file && file instanceof File) {
        const path = await uploadFile(file, driverId, key);
        if (path) driverDocUrls[`${key}_url`] = path;
      }
    }
    if (Object.keys(driverDocUrls).length > 0) {
      await supabaseAdmin.from("drivers").update(driverDocUrls).eq("id", driverId);
    }

    // 4. Upload truck documents
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

    // 5. Mark token as completed
    await supabaseAdmin
      .from("onboarding_tokens")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

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

// deno-lint-ignore-file no-explicit-any
// Onboarding de un Owner Operator que YA trabaja con nosotros (link creado desde la landing con su email):
//  • JSON { action: "context", token }  → nombre del OO, sus camiones y sus drivers (para elegir en el formulario)
//  • multipart action=submit, mode=add_driver → driver nuevo en uno de sus camiones
//  • multipart action=submit, mode=add_truck  → camión nuevo + driver (suyo o nuevo) + leasing firmado
// El OO se identifica por el token: existing_investor_id (ficha de investor) o existing_owner_driver_id
// (OO que maneja su propio camión; si hace falta, se le crea la ficha de investor).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isEnabled, sendTextLogged } from "../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Columna del leasing en drivers según la empresa (igual que el onboarding completo)
const LEASING_COLUMN_MAP: Record<string, string> = {
  "789196fd-825a-45ea-b9e2-6da6bc189b10": "leasing_agreement_url",     // AG-AR
  "21f1d144-908f-4b6b-85e6-1e15e33ac0a3": "leasing_agreement_58_url",  // 58 Logistics
};

async function loadToken(supabase: any, token: string) {
  const { data: t } = await supabase.from("onboarding_tokens").select("*").eq("token", token).maybeSingle();
  if (!t) throw new Error("Link inválido");
  if (t.status !== "pending") throw new Error("Este link ya se usó");
  if (new Date(t.expires_at) < new Date()) throw new Error("Este link venció. Pide uno nuevo.");
  if (!t.existing_investor_id && !t.existing_owner_driver_id) throw new Error("Este link no es de un Owner Operator registrado");
  return t;
}

/** Ficha del OO: la de investor, o el driver que maneja su propio camión */
async function ownerOf(supabase: any, t: any) {
  if (t.existing_investor_id) {
    const { data: inv } = await supabase.from("investors").select("id, name, email, phone, tenant_id").eq("id", t.existing_investor_id).maybeSingle();
    if (!inv) throw new Error("No encontramos al Owner Operator");
    const { data: selfDriver } = await supabase.from("drivers").select("id, truck_id").eq("tenant_id", t.tenant_id).ilike("email", inv.email ?? "-").maybeSingle();
    return { investorId: inv.id as string | null, ownerDriverId: selfDriver?.id ?? null, name: inv.name, email: inv.email, phone: inv.phone };
  }
  const { data: d } = await supabase.from("drivers").select("*").eq("id", t.existing_owner_driver_id).maybeSingle();
  if (!d) throw new Error("No encontramos al Owner Operator");
  const { data: inv } = await supabase.from("investors").select("id").eq("tenant_id", t.tenant_id).ilike("email", d.email ?? "-").maybeSingle();
  return { investorId: inv?.id ?? null, ownerDriverId: d.id as string, name: d.name, email: d.email, phone: d.phone, driver: d };
}

/** Si el OO no tiene ficha de investor (maneja su propio camión), se crea con sus datos para pagarle los otros camiones */
async function ensureInvestor(supabase: any, owner: any, tenantId: string): Promise<string> {
  if (owner.investorId) return owner.investorId;
  const d = owner.driver ?? {};
  const { data, error } = await supabase.from("investors").insert({
    tenant_id: tenantId, name: owner.name, email: owner.email, phone: owner.phone,
    address: d.address ?? null, city: d.city ?? null, state: d.state ?? null, zip: d.zip ?? null,
    bank_name: d.bank_name ?? null, account_holder_name: d.account_holder_name ?? null,
    routing_number: d.routing_number ?? null, account_number: d.account_number ?? null,
    account_type: d.account_type ?? "checking", pay_percentage: 0,
  }).select("id").single();
  if (error) throw new Error(`No se pudo crear la ficha del Owner Operator: ${error.message}`);
  owner.investorId = data.id;
  return data.id;
}

/** Camiones y drivers del OO */
async function ownerFleet(supabase: any, owner: any, tenantId: string) {
  const driverIds = new Set<string>();
  if (owner.ownerDriverId) driverIds.add(owner.ownerDriverId);
  if (owner.investorId) {
    const [{ data: links }, { data: byCol }] = await Promise.all([
      supabase.from("driver_investors").select("driver_id").eq("investor_id", owner.investorId),
      supabase.from("drivers").select("id").eq("investor_id", owner.investorId),
    ]);
    for (const l of [...(links ?? []), ...(byCol ?? [])]) driverIds.add(String((l as any).driver_id ?? (l as any).id));
  }
  const { data: drivers } = driverIds.size
    ? await supabase.from("drivers").select("id, name, truck_id, status").in("id", [...driverIds]).neq("status", "inactive")
    : { data: [] };
  const truckIds = new Set<string>(((drivers as any[]) ?? []).map((d) => d.truck_id).filter(Boolean).map(String));
  const { data: ownTrucks } = owner.investorId
    ? await supabase.from("trucks").select("id").eq("investor_id", owner.investorId)
    : { data: [] };
  for (const t of (ownTrucks as any[]) ?? []) truckIds.add(String(t.id));
  const { data: trucks } = truckIds.size
    ? await supabase.from("trucks").select("id, unit_number, truck_type, make, model, year, vin, status").eq("tenant_id", tenantId).in("id", [...truckIds]).neq("status", "inactive")
    : { data: [] };
  return { drivers: (drivers as any[]) ?? [], trucks: (trucks as any[]) ?? [] };
}

async function notifyAdmin(supabase: any, tenantId: string, title: string, message: string, driverId?: string | null) {
  await supabase.from("notifications").insert({ tenant_id: tenantId, type: "onboarding", title, message, driver_id: driverId ?? null });
  try {
    if (!(await isEnabled(supabase, tenantId, "wa_onboarding"))) return;
    const { data: tenant } = await supabase.from("tenants").select("whatsapp_admin_group_id").eq("id", tenantId).maybeSingle();
    if (!tenant?.whatsapp_admin_group_id) return;
    await sendTextLogged(supabase, {
      tenantId, templateKey: "onboarding_oo_driver", recipientType: "admin", recipientName: title,
      groupId: tenant.whatsapp_admin_group_id, message: `${title}\n${message}`, reference: title,
    });
  } catch (e) { console.error("notifyAdmin whatsapp:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // ── Contexto para el formulario ──
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await req.json();
      const t = await loadToken(supabase, String(body.token ?? ""));
      const owner = await ownerOf(supabase, t);
      const fleet = await ownerFleet(supabase, owner, t.tenant_id);
      return json({ mode: t.oo_mode, owner: { name: owner.name }, trucks: fleet.trucks, drivers: fleet.drivers.map((d) => ({ id: d.id, name: d.name, truck_id: d.truck_id })) });
    }

    // ── Envío ──
    const form = await req.formData();
    const t = await loadToken(supabase, String(form.get("token") ?? ""));
    const tenantId = t.tenant_id as string;
    const mode = String(form.get("mode") ?? t.oo_mode);
    const owner = await ownerOf(supabase, t);
    const fleet = await ownerFleet(supabase, owner, tenantId);

    const upload = async (file: File | null, folder: string, name: string) => {
      if (!(file instanceof File)) return null;
      const ext = file.name.split(".").pop() || "bin";
      const path = `${folder}/${name}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
      if (error) { console.error(`upload ${path}:`, error); return null; }
      return path;
    };

    // Driver nuevo del OO (lo usan los dos modos)
    const createDriver = async (d: any, truckId: string) => {
      if (!d?.name || !d?.email || !d?.phone || !d?.license) throw new Error("Faltan datos del driver: nombre, email, teléfono y licencia");
      const investorId = await ensureInvestor(supabase, owner, tenantId);
      const { data: nd, error } = await supabase.from("drivers").insert({
        tenant_id: tenantId, name: d.name, email: d.email, phone: d.phone, license: d.license,
        license_expiry: d.license_expiry || null, medical_card_expiry: d.medical_card_expiry || null,
        status: "pending", service_type: "owner_operator", dispatcher_id: t.dispatcher_id || null,
        truck_id: truckId, hire_date: new Date().toISOString().split("T")[0],
        state: d.state || null, address: d.address || null, city: d.city || null, zip: d.zip || null,
        birthday: d.birthday || null, emergency_contact_name: d.emergency_contact_name || null, emergency_phone: d.emergency_phone || null,
        investor_id: investorId, investor_name: owner.name, investor_email: owner.email,
      }).select("id").single();
      if (error) throw new Error(`No se pudo crear el driver: ${error.message}`);
      const docs: Record<string, string> = {};
      const lic = await upload(form.get("driver_license_photo") as File | null, nd.id, "license_photo");
      const med = await upload(form.get("driver_medical_card_photo") as File | null, nd.id, "medical_card_photo");
      if (lic) docs.license_photo_url = lic;
      if (med) docs.medical_card_photo_url = med;
      if (Object.keys(docs).length) await supabase.from("drivers").update(docs).eq("id", nd.id);
      // El OO recibe el pago de este driver (el % lo configura dispatch)
      await supabase.from("driver_investors").insert({
        driver_id: nd.id, investor_id: investorId, investor_name: owner.name, investor_email: owner.email,
        pay_percentage: 0, tenant_id: tenantId,
      });
      return nd.id as string;
    };

    if (mode === "add_driver") {
      const truckId = String(form.get("truck_id") ?? "");
      if (!fleet.trucks.some((tr) => tr.id === truckId)) throw new Error("Elige uno de tus camiones");
      const d = JSON.parse(String(form.get("driver_data") ?? "{}"));
      const driverId = await createDriver(d, truckId);
      await supabase.from("onboarding_tokens").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", t.id);
      const unit = fleet.trucks.find((tr) => tr.id === truckId)?.unit_number;
      await notifyAdmin(supabase, tenantId, `Driver nuevo de ${owner.name}`, `${d.name} (${d.phone}) se registró para manejar el Unit #${unit ?? "?"} de ${owner.name}. Revísalo en Drivers.`, driverId);
      return json({ success: true, driver_id: driverId });
    }

    if (mode === "add_truck") {
      const truck = JSON.parse(String(form.get("truck_data") ?? "{}"));
      if (!truck.unit_number || !truck.vin) throw new Error("Faltan datos del camión: Unit # y VIN");
      const investorId = await ensureInvestor(supabase, owner, tenantId);
      const { data: nt, error: te } = await supabase.from("trucks").insert({
        tenant_id: tenantId, investor_id: investorId, status: "active",
        unit_number: truck.unit_number, truck_type: truck.truck_type || "Box Truck", make: truck.make || null, model: truck.model || null,
        year: truck.year || null, max_payload_lbs: truck.max_payload_lbs || null, vin: truck.vin || null, license_plate: truck.license_plate || null,
        insurance_expiry: truck.insurance_expiry || null, registration_expiry: truck.registration_expiry || null,
        annual_inspection_expiry: truck.annual_inspection_expiry || null,
        cargo_length_ft: truck.cargo_length_ft || null, cargo_width_in: truck.cargo_width_in || null, cargo_height_in: truck.cargo_height_in || null,
        rear_door_width_in: truck.rear_door_width_in || null, rear_door_height_in: truck.rear_door_height_in || null,
        trailer_length_ft: truck.trailer_length_ft || null, mega_ramp: truck.mega_ramp || null,
      }).select("id").single();
      if (te) throw new Error(`No se pudo crear el camión: ${te.message}`);
      const truckId = nt.id as string;

      try {
        // Documentos del camión
        const docs: Record<string, string> = {};
        for (const key of ["registration_photo", "insurance_photo", "annual_inspection_photo", "rear_truck_photo", "truck_side_photo", "truck_plate_photo", "cargo_area_photo"]) {
          const p = await upload(form.get(`truck_${key}`) as File | null, truckId, `truck_${key}`);
          if (p) docs[`${key}_url`] = p;
        }
        if (Object.keys(docs).length) await supabase.from("trucks").update(docs).eq("id", truckId);

        // Driver del camión: uno del OO (se pasa a este camión) o uno nuevo
        let driverId: string;
        if (String(form.get("driver_mode")) === "existing") {
          driverId = String(form.get("driver_id") ?? "");
          if (!fleet.drivers.some((d) => d.id === driverId)) throw new Error("Elige uno de tus drivers");
          await supabase.from("drivers").update({ truck_id: truckId }).eq("id", driverId);
        } else {
          driverId = await createDriver(JSON.parse(String(form.get("driver_data") ?? "{}")), truckId);
        }
        await supabase.from("trucks").update({ driver_id: driverId }).eq("id", truckId);

        // Leasing firmado (uno por empresa con leasing activo)
        const leasingUpdates: Record<string, string> = {};
        for (const [key, value] of form.entries()) {
          if (!key.startsWith("leasing_") || !(value instanceof File)) continue;
          const companyId = key.replace("leasing_", "");
          const path = await upload(value, truckId, `leasing_${companyId}`);
          if (!path) continue;
          const { data: co } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
          await supabase.from("driver_leasing_agreements").insert({ driver_id: driverId, company_id: companyId, company_name: co?.name ?? companyId, file_url: path, tenant_id: tenantId });
          const col = LEASING_COLUMN_MAP[companyId];
          if (col) leasingUpdates[col] = path;
        }
        if (Object.keys(leasingUpdates).length) await supabase.from("drivers").update(leasingUpdates).eq("id", driverId);

        await supabase.from("onboarding_tokens").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", t.id);
        const { data: drv } = await supabase.from("drivers").select("name").eq("id", driverId).maybeSingle();
        await notifyAdmin(supabase, tenantId, `Camión nuevo de ${owner.name}`,
          `${owner.name} registró el Unit #${truck.unit_number} (${[truck.year, truck.make, truck.model].filter(Boolean).join(" ")}) con el driver ${drv?.name ?? ""} y firmó el leasing. Revísalo en Fleet y Drivers.`, driverId);
        return json({ success: true, truck_id: truckId, driver_id: driverId });
      } catch (e) {
        // Sin driver o con error: no dejar un camión a medias
        await supabase.from("trucks").delete().eq("id", truckId);
        throw e;
      }
    }

    return json({ error: "Opción desconocida" }, 400);
  } catch (e) {
    console.error("onboarding-oo error:", e);
    return json({ error: errMsg(e) }, 400);
  }
});

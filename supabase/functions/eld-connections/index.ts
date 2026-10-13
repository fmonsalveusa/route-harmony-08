// deno-lint-ignore-file no-explicit-any
// Conexión ELD propia de un driver: guardar (contraseña a Vault), probar y borrar. Solo admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hos247, levelEldUnits, routeOne, type EldCreds } from "../_shared/eld.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

/** Entra al portal y devuelve las unidades que tiene la cuenta */
async function listUnits(provider: string, creds: EldCreds): Promise<{ unit: string; vin: string | null }[]> {
  if (provider === "hos247") {
    const { get } = await hos247(creds);
    return (await get("/vehicles?$limit=500")).map((v) => ({ unit: String(v.name ?? ""), vin: v.vin ?? null }));
  }
  if (provider === "leveleld") {
    return (await levelEldUnits(creds.password)).map((u) => ({ unit: String(u.unit_number ?? u.truck?.unit_number ?? ""), vin: u.truck?.vin ?? null }));
  }
  const { gql } = await routeOne(creds);
  const r = await gql(
    "query MaintenanceAssignableAssets($input: AssignableAssetsInput!) { maintenanceAssignableAssets(input: $input) { assetLabel } }",
    { input: { assetType: "vehicle" } },
  );
  return ((r?.maintenanceAssignableAssets ?? []) as any[]).map((a) => ({ unit: String(a.assetLabel), vin: null }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!((roles as any[]) || []).some((r) => ["admin", "master_admin"].includes(r.role))) return json({ error: "Solo un admin puede manejar conexiones ELD" }, 403);
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const { data: driver } = await supabase.from("drivers").select("id, name, tenant_id, truck_id").eq("id", body.driver_id).maybeSingle();
    if (!driver || driver.tenant_id !== profile?.tenant_id) return json({ error: "Driver no encontrado" }, 404);

    if (body.action === "delete") {
      await supabase.rpc("eld_connection_delete", { p_driver_id: driver.id });
      return json({ deleted: true });
    }

    if (body.action === "save") {
      const provider = String(body.provider ?? "");
      // Level ELD no usa usuario: se conecta con el token de empresa
      const username = String(body.username ?? "").trim() || (provider === "leveleld" ? "Level ELD" : "");
      if (!["hos247", "routeone", "leveleld"].includes(provider) || !username) return json({ error: "Falta el proveedor o el usuario" }, 400);
      const { data: existing } = await supabase.from("driver_eld_connections").select("secret_id").eq("driver_id", driver.id).maybeSingle();
      if (!existing?.secret_id && !body.password) return json({ error: provider === "leveleld" ? "Pega el token de Level ELD" : "Escribe la contraseña" }, 400);
      await supabase.from("driver_eld_connections").upsert({
        driver_id: driver.id, tenant_id: driver.tenant_id, provider, username, status: "pending", last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "driver_id" });
      if (body.password) {
        const { error } = await supabase.rpc("eld_connection_set_password", { p_driver_id: driver.id, p_password: String(body.password) });
        if (error) return json({ error: `No se pudo guardar la contraseña: ${error.message}` }, 500);
      }
      // Tras guardar, se prueba de una vez
      body.action = "test";
    }

    if (body.action === "test") {
      const { data: conn } = await supabase.from("driver_eld_connections").select("provider, username").eq("driver_id", driver.id).maybeSingle();
      const { data: password } = await supabase.rpc("eld_connection_password", { p_driver_id: driver.id });
      if (!conn || !password) return json({ error: "La conexión no está completa" }, 400);
      const now = new Date().toISOString();
      try {
        const units = await listUnits(conn.provider, { user: conn.username, password });
        const { data: truck } = driver.truck_id
          ? await supabase.from("trucks").select("unit_number, vin").eq("id", driver.truck_id).maybeSingle()
          : { data: null };
        const match = units.find((u) => truck && (norm(u.unit) === norm(truck.unit_number) || (u.vin && truck.vin && norm(u.vin) === norm(truck.vin))))
          ?? (units.length === 1 ? units[0] : null);
        await supabase.from("driver_eld_connections").update({
          status: "ok", last_error: null, last_ok_at: now, last_tested_at: now, matched_unit: match?.unit ?? null, updated_at: now,
        }).eq("driver_id", driver.id);
        return json({ ok: true, units: units.map((u) => u.unit), matched_unit: match?.unit ?? null });
      } catch (e) {
        await supabase.from("driver_eld_connections").update({
          status: "error", last_error: errMsg(e).slice(0, 300), last_tested_at: now, updated_at: now,
        }).eq("driver_id", driver.id);
        return json({ ok: false, error: errMsg(e) });
      }
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("eld-connections error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

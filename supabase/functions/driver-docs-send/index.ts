// Reenvía al driver sus documentos firmados (leasing, W9, service agreement)
// por email (adjuntos) y/o a su grupo de WhatsApp. Lo usa el botón del detalle del driver.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { collectSignedDocs, emailSignedDocs, whatsappSignedDocs } from "../_shared/driverDocs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const staff = ((roles as any[]) || []).some((r) => ["admin", "accounting", "dispatcher", "master_admin"].includes(r.role));
  if (!staff) return json({ error: "Unauthorized" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const { driver_id, keys, channels, caption } = body as { driver_id: string; keys?: string[]; channels?: string[]; caption?: string };
    if (!driver_id) return json({ error: "Falta driver_id" }, 400);

    const { data: profile } = await sb.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const { data: driver } = await sb.from("drivers")
      .select("id, name, email, tenant_id, whatsapp_group_id, whatsapp_group_name").eq("id", driver_id).maybeSingle();
    if (!driver || (profile?.tenant_id && driver.tenant_id !== profile.tenant_id)) return json({ error: "Driver no encontrado" }, 404);

    const all = await collectSignedDocs(sb, "driver", driver.id);
    const docs = keys?.length ? all.filter((d) => keys.includes(d.key)) : all;

    // Solo listar lo que hay (para el diálogo)
    if (body.action === "list") {
      return json({
        docs: all.map((d) => ({ key: d.key, label: d.label })),
        email: driver.email, group: driver.whatsapp_group_id ? (driver.whatsapp_group_name || "Grupo del driver") : null,
      });
    }

    const result: Record<string, { ok: boolean; error?: string }> = {};
    const first = String(driver.name || "").trim().split(/\s+/)[0] || "";
    if (channels?.includes("whatsapp")) {
      try {
        await whatsappSignedDocs(sb, driver.tenant_id, driver.whatsapp_group_id, driver.whatsapp_group_name, driver.name, docs,
          caption?.trim() || `Hola ${first}, aquí tienes copia de tus documentos firmados con 58 Logistics 📄`);
        result.whatsapp = { ok: true };
      } catch (e) { result.whatsapp = { ok: false, error: errMsg(e) }; }
    }
    if (channels?.includes("email")) {
      try {
        await emailSignedDocs(sb, driver.email, driver.name, docs);
        result.email = { ok: true };
      } catch (e) { result.email = { ok: false, error: errMsg(e) }; }
    }
    return json({ result, sent: docs.map((d) => d.label) });
  } catch (e) {
    console.error("driver-docs-send error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

// deno-lint-ignore-file no-explicit-any
// Lee el W-9 subido de un driver con IA y guarda sus datos fiscales (payee_tax_info) para los 1099.
//  • { driver_id } / { investor_id } → uno (sobrescribe lo que haya)
//  • { all: true }            → todos los drivers con W-9 que aún no tienen SSN/EIN
// Solo admin y accounting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
/** Las notas de la IA no deben repetir SSN/EIN completos: se dejan los últimos 4 */
const maskIds = (s: string) => s.replace(/\d{3}-?\d{2}-?(\d{4})|\d{2}-(\d{3})(\d{4})/g, (_m, a, _b, c) => `***${a ?? c}`);

/** Ruta dentro del bucket driver-documents a partir de lo guardado en drivers.form_w9_url */
function storagePath(stored: string): string | null {
  const m = stored.match(/\/driver-documents\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return stored.startsWith("http") ? null : stored;
}

const TOOL = {
  name: "save_w9",
  description: "Save the taxpayer data read from an IRS Form W-9",
  input_schema: {
    type: "object",
    properties: {
      is_w9: { type: "boolean", description: "True if the document is an IRS Form W-9" },
      name: { type: "string", description: "Line 1: name of entity/individual, exactly as written" },
      business_name: { type: "string", description: "Line 2: business name / disregarded entity name, if any; empty otherwise" },
      tax_classification: {
        type: "string",
        enum: ["individual_sole_proprietor", "c_corporation", "s_corporation", "partnership", "trust_estate", "llc_c", "llc_s", "llc_p", "other", "unknown"],
        description: "Box 3a federal tax classification that is checked",
      },
      ssn: { type: "string", description: "Part I Social Security Number, digits only; empty if blank" },
      ein: { type: "string", description: "Part I Employer Identification Number, digits only; empty if blank" },
      notes: { type: "string", description: "Anything unclear or illegible" },
    },
    required: ["is_w9", "name", "business_name", "tax_classification", "ssn", "ein", "notes"],
  },
};

async function readW9(bytes: Uint8Array, mediaType: string): Promise<any> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  const isPdf = mediaType === "application/pdf";
  const source = { type: "base64", media_type: mediaType, data: encodeBase64(bytes) };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "auto" }, // este modelo no acepta forzar la herramienta
      messages: [{
        role: "user",
        content: [
          isPdf ? { type: "document", source } : { type: "image", source },
          { type: "text", text: "Read this IRS Form W-9 (it may be handwritten or scanned) and call the save_w9 tool with its data (always call it, even if the document is not a W-9). Copy the SSN or EIN digits exactly; leave a field empty when it is blank or not legible." },
        ],
      }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`IA HTTP ${r.status}: ${String(j?.error?.message ?? "").slice(0, 160)}`);
  const use = (j.content ?? []).find((c: any) => c.type === "tool_use");
  if (!use) throw new Error("La IA no devolvió datos");
  return use.input;
}

async function processDriver(supabase: any, d: any, recipientType: "driver" | "investor" = "driver") {
  const path = storagePath(String(d.form_w9_url));
  if (!path) return { driver: d.name, error: "El W-9 no está en el almacenamiento" };
  const { data: file, error } = await supabase.storage.from("driver-documents").download(path);
  if (error || !file) return { driver: d.name, error: "El archivo del W-9 no está en el almacenamiento: vuelve a subirlo" };
  const lower = path.toLowerCase();
  const mediaType = lower.endsWith(".pdf") ? "application/pdf"
    : lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const w9 = await readW9(new Uint8Array(await file.arrayBuffer()), file.type && file.type !== "application/octet-stream" ? file.type : mediaType);
  if (!w9.is_w9) return { driver: d.name, error: "El documento no parece un W-9" };

  const ein = digits(w9.ein), ssn = digits(w9.ssn);
  const taxId = ein.length === 9 ? ein : ssn.length === 9 ? ssn : "";
  // Con EIN el 1099 va a la compañía (línea 2 si es una LLC sin personería, si no la línea 1)
  const business = ein.length === 9;
  const legal = business ? (String(w9.business_name ?? "").trim() || String(w9.name ?? "").trim()) : String(w9.name ?? "").trim();
  await supabase.from("payee_tax_info").upsert({
    recipient_type: recipientType, recipient_id: d.id, tenant_id: d.tenant_id,
    entity_type: business ? "business" : "individual", legal_name: legal || null, tax_id: taxId || null,
    business_name: String(w9.business_name ?? "").trim() || null, tax_classification: w9.tax_classification ?? null,
    source: "w9", notes: maskIds(String(w9.notes ?? "").trim()) || null, updated_at: new Date().toISOString(),
  }, { onConflict: "recipient_type,recipient_id" });
  return {
    driver: d.name, entity: business ? "business" : "individual", legal_name: legal,
    tax_id: taxId ? `***${taxId.slice(-4)}` : null, ...(taxId ? {} : { warning: "No se leyó un SSN/EIN de 9 dígitos" }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("tenant_id, is_master_admin").eq("id", user.id).maybeSingle(),
    ]);
    const allowed = profile?.is_master_admin || ((roles as any[]) || []).some((r) => ["admin", "accounting", "master_admin"].includes(r.role));
    if (!allowed) return json({ error: "Solo admin o accounting" }, 403);

    const body = await req.json().catch(() => ({}));
    // Investor (dueño del camión): su W-9 está en investors.w9_url
    if (body.investor_id) {
      const { data: inv } = await supabase.from("investors").select("id, name, tenant_id, w9_url").eq("id", body.investor_id).eq("tenant_id", profile?.tenant_id).maybeSingle();
      if (!inv?.w9_url) return json({ error: "Este investor no tiene W-9 subido" }, 404);
      try { return json({ results: [await processDriver(supabase, { ...inv, form_w9_url: inv.w9_url }, "investor")] }); }
      catch (e) { return json({ results: [{ driver: inv.name, error: errMsg(e) }] }); }
    }
    let q = supabase.from("drivers").select("id, name, tenant_id, form_w9_url").eq("tenant_id", profile?.tenant_id).not("form_w9_url", "is", null);
    if (body.driver_id) q = q.eq("id", body.driver_id);
    const { data: drivers } = await q;
    let list = (drivers as any[]) || [];
    if (!body.driver_id) {
      // En lote solo los que aún no tienen SSN/EIN (no se pisa lo que alguien ya cargó)
      const { data: done } = await supabase.from("payee_tax_info").select("recipient_id").eq("recipient_type", "driver").not("tax_id", "is", null);
      const has = new Set(((done as any[]) || []).map((r) => r.recipient_id));
      list = list.filter((d) => !has.has(d.id));
    }
    if (body.driver_id && list.length === 0) return json({ error: "Este driver no tiene W-9 subido" }, 404);

    const results = [];
    for (const d of list) {
      try { results.push(await processDriver(supabase, d)); } catch (e) { results.push({ driver: d.name, error: errMsg(e) }); }
    }
    return json({ results });
  } catch (e) {
    console.error("w9-extract error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

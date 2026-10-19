// deno-lint-ignore-file no-explicit-any
// Asistente de factoring RTS: la extensión de Chrome (sobre el portal de RTS) pide aquí las cargas
// listas para facturar con sus documentos, y avisa cuando se enviaron.
// Autenticación: la clave del tenant (integration_keys, kind 'rts_assistant') en el header x-assistant-key.
//  • { action: "list" }                    → cargas entregadas de 58 Logistics en Factoring "pending"
//  • { action: "mark_ready", load_ids }    → Factoring "ready" (genera los pagos) + rts_submitted_at
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-assistant-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Solo se factura por 58 Logistics en RTS
const COMPANY_58 = "21f1d144-908f-4b6b-85e6-1e15e33ac0a3";
const BUCKET = "driver-documents";

function storagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https?:/i.test(url)) return url.replace(/^\/+/, "").replace(/^driver-documents\//, "");
  const m = url.match(/\/driver-documents\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const key = req.headers.get("x-assistant-key")?.trim();
    if (!key) return json({ error: "Falta la clave del asistente" }, 401);
    const { data: k } = await supabase.from("integration_keys").select("tenant_id").eq("kind", "rts_assistant").eq("key", key).maybeSingle();
    if (!k) return json({ error: "Clave inválida. Cópiala de nuevo desde el TMS (Companies → Asistente RTS)." }, 401);
    const tenantId = k.tenant_id;
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data: loads } = await supabase.from("loads")
        .select("id, reference_number, broker_client, total_rate, delivery_date, pdf_url, status")
        .eq("tenant_id", tenantId).eq("company_id", COMPANY_58).eq("factoring", "pending")
        .in("status", ["delivered", "tonu"]).is("rts_submitted_at", null)
        .order("delivery_date", { ascending: true }).limit(50);
      const list = (loads as any[]) || [];
      const ids = list.map((l) => l.id);
      const [{ data: stops }, { data: pods }] = await Promise.all([
        ids.length ? supabase.from("load_stops").select("id, load_id, stop_type, stop_order").in("load_id", ids) : { data: [] },
        ids.length ? supabase.from("pod_documents").select("load_id, stop_id, file_url, file_name, file_type, created_at").in("load_id", ids).order("created_at") : { data: [] },
      ]);
      const sign = async (path: string | null) => {
        if (!path) return null;
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        return data?.signedUrl ?? null;
      };
      const out = [];
      for (const l of list) {
        const deliveries = ((stops as any[]) || []).filter((s) => s.load_id === l.id && s.stop_type === "delivery");
        const deliveryIds = new Set(deliveries.map((s) => s.id));
        // POD de cada entrega: los PDF (escaneados o firmados) o los archivos llamados "POD"; sin fotos
        const podDocs = ((pods as any[]) || []).filter((p) => p.load_id === l.id && deliveryIds.has(p.stop_id)
          && (p.file_type === "pdf" || /^pod\b/i.test(p.file_name ?? "")));
        const docs: { name: string; url: string | null; kind: string }[] = [];
        const rcPath = storagePath(l.pdf_url);
        if (rcPath) docs.push({ name: `RC ${l.reference_number}.pdf`, url: await sign(rcPath), kind: "rc" });
        for (const p of podDocs) docs.push({ name: p.file_name || `POD ${l.reference_number}.pdf`, url: await sign(storagePath(p.file_url)), kind: "pod" });
        out.push({
          id: l.id, reference: l.reference_number, broker: l.broker_client ?? "", amount: Number(l.total_rate) || 0,
          delivery_date: l.delivery_date, status: l.status,
          deliveries: deliveries.length, has_rc: !!rcPath, pods: podDocs.length,
          docs: docs.filter((d) => d.url),
        });
      }
      return json({ loads: out });
    }

    if (body.action === "mark_ready") {
      const ids = Array.isArray(body.load_ids) ? body.load_ids.map(String) : [];
      if (!ids.length) return json({ error: "Sin cargas" }, 400);
      const { data, error } = await supabase.from("loads")
        .update({ factoring: "ready", rts_submitted_at: new Date().toISOString() })
        .eq("tenant_id", tenantId).eq("factoring", "pending").in("id", ids)
        .select("reference_number");
      if (error) return json({ error: error.message }, 500);
      return json({ marked: ((data as any[]) || []).map((d) => d.reference_number) });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("rts-assistant error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

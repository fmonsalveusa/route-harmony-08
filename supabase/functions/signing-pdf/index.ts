// Entrega los PDFs de firma que viven en el Storage privado.
// El acceso va por el enlace del documento, igual que la propia página de firma:
// quien tiene el enlace puede ver su PDF, y nadie puede pedir otros archivos del bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const BUCKET = "driver-documents";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Solo PDFs de firma: nada de otros archivos del bucket */
const validPath = (p: string) => /^signing\/[A-Za-z0-9/_-]+\.pdf$/.test(p) && !p.includes("..");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Guardar: lo usa quien firma, que no tiene sesión y no puede escribir en el Storage
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const target = String(body?.path ?? "");
    const dataUrl = String(body?.data ?? "");
    if (!validPath(target) || !dataUrl.startsWith("data:")) {
      return json({ error: "Ruta o archivo inválido" }, 400);
    }
    const base64 = dataUrl.split(",")[1] ?? "";
    if (base64.length > 28_000_000) return json({ error: "El PDF es demasiado grande" }, 413);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const { error } = await supabaseAdmin.storage
      .from(BUCKET).upload(target, bytes, { upsert: true, contentType: "application/pdf" });
    if (error) return json({ error: error.message }, 500);
    return json({ path: target });
  }

  const path = new URL(req.url).searchParams.get("path") ?? "";

  if (req.method === "DELETE") {
    if (!validPath(path)) return json({ error: "Ruta inválida" }, 400);
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return json({ deleted: path });
  }
  if (!validPath(path)) return json({ error: "Ruta inválida" }, 400);

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) return json({ error: "No se encontró el archivo" }, 404);

  return new Response(await data.arrayBuffer(), {
    headers: { ...corsHeaders, "Content-Type": "application/pdf", "Cache-Control": "private, max-age=300" },
  });
});

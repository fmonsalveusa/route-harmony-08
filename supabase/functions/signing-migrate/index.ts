// deno-lint-ignore-file no-explicit-any
// Uso único: mueve al Storage los PDFs de firma que estaban guardados dentro de la base.
// En la base queda la ruta del archivo. Se puede borrar esta función después de correrla.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const BUCKET = "driver-documents";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const moved: string[] = [];
  const errors: string[] = [];

  const upload = async (path: string, dataUrl: string) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, dataUrlToBytes(dataUrl), { upsert: true, contentType: "application/pdf" });
    if (error) throw new Error(error.message);
    return path;
  };

  try {
    const { data: docs } = await supabase
      .from("documents").select("id, file_data, signed_file_data").limit(500);

    for (const d of ((docs as any[]) || [])) {
      const updates: Record<string, string> = {};
      try {
        if (d.file_data?.startsWith("data:")) {
          updates.file_data = await upload(`signing/${d.id}/original.pdf`, d.file_data);
        }
        if (d.signed_file_data?.startsWith("data:")) {
          updates.signed_file_data = await upload(`signing/${d.id}/signed.pdf`, d.signed_file_data);
        }
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("documents").update(updates).eq("id", d.id);
          if (error) throw new Error(error.message);
          moved.push(`documento ${d.id}: ${Object.keys(updates).join(", ")}`);
        }
      } catch (e) {
        errors.push(`documento ${d.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const { data: templates } = await supabase.from("templates").select("id, file_data").limit(500);
    for (const t of ((templates as any[]) || [])) {
      try {
        if (!t.file_data?.startsWith("data:")) continue;
        const path = await upload(`signing/templates/${t.id}.pdf`, t.file_data);
        const { error } = await supabase.from("templates").update({ file_data: path }).eq("id", t.id);
        if (error) throw new Error(error.message);
        moved.push(`plantilla ${t.id}`);
      } catch (e) {
        errors.push(`plantilla ${t.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    return json({ movidos: moved.length, detalle: moved, errores: errors });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

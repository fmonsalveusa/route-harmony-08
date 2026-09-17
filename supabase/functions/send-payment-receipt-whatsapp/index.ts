import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { isEnabled, logMessage, renderMessage, sendDocumentLogged } from "../_shared/messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_PDF_BYTES = 8 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return json({ error: "No tenant" }, 403);

  try {
    const { recipient_type, recipient_id, recipient_name, file_name, pdf_base64, kind, amount, load_reference, count } = await req.json();
    if (!recipient_type || !pdf_base64 || !file_name) return json({ error: "Bad request" }, 400);
    if (!(await isEnabled(supabase, tenantId, "wa_payment_receipts"))) return json({ skipped: "disabled" });

    const templateKey = kind === "batch" ? "payment_batch" : "payment_single";
    const money = "$" + (Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const baseLog = {
      tenantId,
      templateKey,
      recipientType: recipient_type,
      recipientName: recipient_name ?? null,
      reference: kind === "batch" ? `${count ?? ""} pagos · ${money}`.trim() : `Carga #${load_reference} · ${money}`,
    };

    // Grupo del beneficiario. Los pagos de investor pueden traer el id del driver,
    // así que si no coincide por id se busca por nombre.
    const table = recipient_type === "driver" ? "drivers"
      : recipient_type === "investor" ? "investors"
      : recipient_type === "dispatcher" ? "dispatchers" : null;
    if (!table) return json({ error: "Invalid recipient_type" }, 400);

    let groupId: string | null = null;
    if (recipient_id) {
      const { data } = await supabase.from(table).select("whatsapp_group_id")
        .eq("id", recipient_id).eq("tenant_id", tenantId).maybeSingle();
      groupId = data?.whatsapp_group_id ?? null;
    }
    if (!groupId && recipient_name && table !== "drivers") {
      const { data } = await supabase.from(table).select("whatsapp_group_id")
        .ilike("name", String(recipient_name).trim()).eq("tenant_id", tenantId)
        .not("whatsapp_group_id", "is", null).limit(1).maybeSingle();
      groupId = data?.whatsapp_group_id ?? null;
    }
    if (!groupId) {
      await logMessage(supabase, baseLog, "skipped", "El beneficiario no tiene grupo de WhatsApp");
      return json({ skipped: "recipient without whatsapp group" });
    }

    const bytes = decodeBase64(pdf_base64);
    if (bytes.byteLength > MAX_PDF_BYTES) return json({ error: "PDF too large" }, 400);

    // Se guarda en storage y se envía un link firmado (Whapi descarga el archivo desde ahí)
    const safeName = String(file_name).replace(/[^\w.\-]+/g, "_");
    const path = `receipts/${tenantId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("driver-documents")
      .upload(path, bytes, { contentType: "application/pdf" });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage.from("driver-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) throw new Error(`Signed URL: ${signErr?.message}`);

    const message = await renderMessage(supabase, tenantId, templateKey, {
      monto: money,
      carga: load_reference ?? "",
      beneficiario: recipient_name ?? "",
      cantidad: count ?? "",
    });
    await sendDocumentLogged(supabase, { ...baseLog, groupId, message }, signed.signedUrl, file_name);
    return json({ success: true });
  } catch (e) {
    console.error("send-payment-receipt-whatsapp error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

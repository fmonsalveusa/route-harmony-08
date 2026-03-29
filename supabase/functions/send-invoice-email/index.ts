import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId, brokerEmail } = await req.json();
    if (!invoiceId || !brokerEmail) throw new Error("Missing invoiceId or brokerEmail");

    // Fetch invoice
    const { data: invoice, error: invErr } = await adminClient
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    if (invErr || !invoice) throw new Error("Invoice not found");

    // Fetch load
    const { data: load } = await adminClient
      .from("loads")
      .select("*")
      .eq("id", invoice.load_id)
      .single();

    // Fetch company
    const tenantId = await adminClient.rpc("get_user_tenant_id", { _user_id: user.id });
    const { data: companies } = await adminClient
      .from("companies")
      .select("*")
      .eq("tenant_id", tenantId.data)
      .limit(1);
    const company = invoice.company_id
      ? (await adminClient.from("companies").select("*").eq("id", invoice.company_id).single()).data
      : companies?.[0] || null;

    // Fetch PODs
    const { data: pods } = await adminClient
      .from("pod_documents")
      .select("*")
      .eq("load_id", invoice.load_id);

    // --- Build attachments ---
    const attachments: Array<{ filename: string; content: Uint8Array; contentType: string }> = [];

    // 1) Generate Invoice PDF in-memory using the same logic
    const invoicePdfBytes = buildInvoicePdf(invoice, load, company);
    attachments.push({
      filename: `Invoice_${invoice.invoice_number}.pdf`,
      content: invoicePdfBytes,
      contentType: "application/pdf",
    });

    // 2) Rate Confirmation PDF
    if (load?.pdf_url) {
      const rcBytes = await downloadStorageFile(adminClient, load.pdf_url);
      if (rcBytes) {
        const ext = load.pdf_url.toLowerCase().includes(".pdf") ? "pdf" : "pdf";
        attachments.push({
          filename: `RateConfirmation_${load.reference_number}.${ext}`,
          content: rcBytes,
          contentType: "application/pdf",
        });
      }
    }

    // 3) POD documents
    if (pods && pods.length > 0) {
      for (const pod of pods) {
        let fileUrl = pod.file_url?.trim() || "";

        // If file_url is empty, try to find the file in storage by listing the folder
        if (!fileUrl) {
          console.log("POD has empty file_url, attempting repair:", pod.id, pod.file_name);
          try {
            const folder = `pods/${pod.load_id}`;
            const { data: objects } = await adminClient.storage
              .from("driver-documents")
              .list(folder, { limit: 1000 });
            const match = (objects || []).find((o: any) =>
              o.name === pod.file_name || o.name.endsWith(`_${pod.file_name}`)
            );
            if (match) {
              fileUrl = `${folder}/${match.name}`;
              console.log("Repaired POD path:", fileUrl);
              // Update the record for future use
              await adminClient.from("pod_documents").update({ file_url: fileUrl }).eq("id", pod.id);
            } else {
              console.log("Could not find file in storage for POD:", pod.id);
              continue;
            }
          } catch (e) {
            console.error("Error repairing POD path:", e);
            continue;
          }
        }

        const podBytes = await downloadStorageFile(adminClient, fileUrl);
        if (podBytes) {
          attachments.push({
            filename: pod.file_name,
            content: podBytes,
            contentType: pod.file_type === "image" ? "image/jpeg" : "application/pdf",
          });
        }
      }
    }

    // --- Send email via Gmail SMTP ---
    const gmailUser = (Deno.env.get("GMAIL_USER") ?? "").trim();
    const gmailPassRaw = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
    // Google App Passwords are shown with spaces; SMTP auth expects the 16 chars without whitespace.
    const gmailPass = gmailPassRaw.replace(/\s+/g, "").trim();

    if (!gmailUser) throw new Error("Missing GMAIL_USER secret");
    if (!gmailPass) throw new Error("Missing GMAIL_APP_PASSWORD secret");
    if (gmailPass.length !== 16) {
      throw new Error(
        "Invalid GMAIL_APP_PASSWORD: generate a Google App Password (16 chars) and paste it here (not your normal Gmail password)."
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPass,
        },
      },
    });

    const companyName = company?.name || "Our Company";
    const subject = `Invoice ${invoice.invoice_number} - ${load?.reference_number || ""} | ${companyName}`;

    await client.send({
      from: gmailUser,
      to: brokerEmail,
      subject,
      content: `Dear ${invoice.broker_name},\n\nPlease find attached the invoice and supporting documents for Load ${load?.reference_number || invoice.invoice_number}.\n\nInvoice #: ${invoice.invoice_number}\nAmount: $${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}\nOrigin: ${load?.origin || "N/A"}\nDestination: ${load?.destination || "N/A"}\n\nPlease don't hesitate to contact us if you have any questions.\n\nBest regards,\n${companyName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e4078">Invoice ${invoice.invoice_number}</h2>
        <p>Dear <strong>${invoice.broker_name}</strong>,</p>
        <p>Please find attached the invoice and supporting documents for Load <strong>${load?.reference_number || invoice.invoice_number}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Invoice #</td><td style="padding:6px 12px;border:1px solid #ddd">${invoice.invoice_number}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Amount</td><td style="padding:6px 12px;border:1px solid #ddd">$${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Origin</td><td style="padding:6px 12px;border:1px solid #ddd">${load?.origin || "N/A"}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Destination</td><td style="padding:6px 12px;border:1px solid #ddd">${load?.destination || "N/A"}</td></tr>
        </table>
        <p>Attached documents:</p>
        <ul>${attachments.map(a => `<li>${a.filename}</li>`).join("")}</ul>
        <p style="color:#666;font-size:13px;margin-top:24px">Best regards,<br/><strong>${companyName}</strong></p>
      </div>`,
      attachments: attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        encoding: "binary" as const,
        contentType: a.contentType,
      })),
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-invoice-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Helpers ---

async function downloadStorageFile(
  client: any,
  fileUrl: string
): Promise<Uint8Array | null> {
  try {
    // Extract path from signed URL or direct path
    let filePath = fileUrl;
    if (fileUrl.includes("/object/sign/") || fileUrl.includes("/object/public/")) {
      const match = fileUrl.match(/\/object\/(?:sign|public)\/([^?]+)/);
      if (match) filePath = decodeURIComponent(match[1]);
    } else if (fileUrl.includes("/storage/v1/")) {
      const match = fileUrl.match(/\/storage\/v1\/(?:object\/(?:sign|public)\/)?(driver-documents\/[^?]+)/);
      if (match) filePath = decodeURIComponent(match[1]);
    }

    // Remove bucket prefix if present
    const bucket = "driver-documents";
    const path = filePath.startsWith(`${bucket}/`) ? filePath.substring(bucket.length + 1) : filePath;
    console.log("Downloading POD from path:", path);

    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) {
      console.error("Storage download error:", error, "path:", path);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (e) {
    console.error("downloadStorageFile failed:", e);
    return null;
  }
}

function buildInvoicePdf(invoice: any, load: any, company: any): Uint8Array {
  // Professional PDF matching frontend jsPDF layout (A4: 595.28 x 841.89 pt)
  const pageW = 595.28;
  const margin = 42.52;
  const rightX = pageW - margin;
  let y = 56.69;

  const cmds: string[] = [];

  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const addText = (text: string, x: number, yP: number, size: number, bold = false, align: "left" | "right" | "center" = "left", r = 0, g = 0, b = 0) => {
    const font = bold ? "/F2" : "/F1";
    let tx = x;
    if (align === "right") tx = x - text.length * size * 0.45;
    else if (align === "center") tx = x - (text.length * size * 0.45) / 2;
    cmds.push(`${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)} rg`);
    cmds.push(`BT ${font} ${size} Tf ${tx.toFixed(2)} ${(841.89 - yP).toFixed(2)} Td (${esc(text)}) Tj ET`);
  };

  const fillRect = (x: number, yP: number, w: number, h: number, r: number, g: number, b: number) => {
    cmds.push(`${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)} rg`);
    cmds.push(`${x.toFixed(2)} ${(841.89 - yP - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    cmds.push(`0.784 0.784 0.784 RG 0.5 w ${x1.toFixed(2)} ${(841.89-y1).toFixed(2)} m ${x2.toFixed(2)} ${(841.89-y2).toFixed(2)} l S`);
  };

  // Company header (right-aligned)
  if (company) {
    addText(company.name, rightX, y, 16, true, "right");
    y += 17;
    if (company.address) { addText(company.address, rightX, y, 9, false, "right"); y += 11; }
    const cityLine = `${company.city||""}, ${company.state||""} ${company.zip||""}`.trim();
    if (cityLine.length > 2) { addText(cityLine, rightX, y, 9, false, "right"); y += 11; }
    if (company.phone) { addText(`Phone: ${company.phone}`, rightX, y, 9, false, "right"); y += 11; }
    if (company.email) { addText(`Email: ${company.email}`, rightX, y, 9, false, "right"); y += 11; }
    if (company.mc_number) { addText(`MC# ${company.mc_number}`, rightX, y, 9, false, "right"); y += 11; }
    if (company.dot_number) { addText(`DOT# ${company.dot_number}`, rightX, y, 9, false, "right"); y += 11; }
  }

  // INVOICE title
  y = Math.max(y + 22, 142);
  addText("INVOICE", margin, y, 24, true, "left", 30, 64, 120);

  // Invoice # and Date
  y += 34;
  addText("Invoice #:", margin, y, 10, true);
  addText(invoice.invoice_number, margin + 113, y, 10);
  addText("Date:", pageW / 2 + 28, y, 10, true);
  addText(new Date(invoice.created_at).toLocaleDateString("en-US"), pageW / 2 + 85, y, 10);

  // BILL TO section
  y += 40;
  fillRect(margin, y - 11, pageW - margin * 2, 28, 240, 240, 245);
  addText("BILL TO", margin + 9, y + 9, 11, true);
  y += 40;
  addText(invoice.broker_name, margin + 9, y, 12, true);
  y += 17;

  // LOAD DETAILS header
  y += 28;
  fillRect(margin, y - 11, pageW - margin * 2, 28, 30, 64, 120);
  addText("LOAD DETAILS", margin + 9, y + 9, 10, true, "left", 255, 255, 255);
  y += 40;

  // Detail rows
  const addRow = (label: string, value: string) => {
    addText(label, margin + 9, y, 10, true);
    addText(value, margin + 156, y, 10);
    y += 20;
  };

  addRow("Load Reference:", load?.reference_number || invoice.invoice_number);
  addRow("Origin:", load?.origin || "N/A");
  addRow("Destination:", load?.destination || "N/A");
  if (load?.pickup_date) addRow("Pickup Date:", new Date(load.pickup_date).toLocaleDateString("en-US"));
  if (load?.delivery_date) addRow("Delivery Date:", new Date(load.delivery_date).toLocaleDateString("en-US"));
  if (load?.miles && Number(load.miles) > 0) addRow("Miles:", Number(load.miles).toLocaleString());

  // Total
  y += 22;
  drawLine(margin, y, rightX, y);
  y += 28;
  addText("TOTAL DUE:", margin + 9, y, 14, true);
  const totalStr = `$${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  addText(totalStr, rightX - 9, y, 14, true, "right", 30, 64, 120);

  // Footer
  y += 57;
  addText("Thank you for your business!", pageW / 2, y, 9, false, "center", 120, 120, 120);

  // Build PDF structure
  const streamContent = cmds.join("\n");
  const streamBytes = new TextEncoder().encode(streamContent);

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);
  objects.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream\nendobj`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  objects.push("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj + "\n";
  }

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(body);
}

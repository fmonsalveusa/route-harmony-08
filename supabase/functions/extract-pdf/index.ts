import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_SIZE = 13 * 1024 * 1024;

function looksLikePdf(bytes: Uint8Array): boolean {
  const scanLimit = Math.min(bytes.length, 1024);
  const needle = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  for (let i = 0; i <= scanLimit - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

async function fetchPdfBytes(pdfUrl: string): Promise<Uint8Array> {
  const resp = await fetch(pdfUrl, { method: "GET" });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`No se pudo descargar el PDF (HTTP ${resp.status})${t ? `: ${t.slice(0, 200)}` : ""}`);
  }
  const contentLength = resp.headers.get("content-length");
  if (contentLength) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > MAX_PDF_BYTES) {
      await resp.arrayBuffer().catch(() => null);
      throw new Error("PDF too large (max 10MB)");
    }
  }
  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_PDF_BYTES) throw new Error("PDF too large (max 10MB)");
  return new Uint8Array(buffer);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar admin client para validar el token server-side (evita parsing local de ES256)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No active tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const pdfBase64 = body?.pdfBase64;
    const pdfUrl = body?.pdfUrl;

    if ((!pdfBase64 || typeof pdfBase64 !== "string") && (!pdfUrl || typeof pdfUrl !== "string")) {
      return new Response(JSON.stringify({ error: "PDF data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("extract-pdf request received", {
      mode: pdfUrl ? "url" : "base64",
      base64Length: typeof pdfBase64 === "string" ? pdfBase64.length : 0,
    });

    // Obtener el base64 del PDF
    let finalBase64 = "";

    if (pdfUrl && typeof pdfUrl === "string") {
      if (!/^https?:\/\//i.test(pdfUrl)) {
        return new Response(JSON.stringify({ error: "Invalid PDF URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = await fetchPdfBytes(pdfUrl);
      if (!looksLikePdf(bytes)) {
        return new Response(JSON.stringify({ error: "File is not a valid PDF" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalBase64 = encodeBase64(bytes);
    } else {
      if (pdfBase64.length > MAX_BASE64_SIZE) {
        return new Response(JSON.stringify({ error: "PDF too large (max 10MB)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const decoded = atob(pdfBase64.slice(0, 200));
        if (!decoded.includes("%PDF-")) {
          return new Response(JSON.stringify({ error: "File is not a valid PDF" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid base64 encoding" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalBase64 = pdfBase64;
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing PDF with Claude AI...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        tools: [
          {
            name: "extract_load_data",
            description: "Extract structured load/shipment data from a document, including all stops",
            input_schema: {
              type: "object",
              properties: {
                referenceNumber: {
                  type: "string",
                  description: "Reference number, confirmation number, or load number",
                },
                brokerClient: {
                  type: "string",
                  description: "Broker or client company name (the company hiring the carrier)",
                },
                carrierName: {
                  type: "string",
                  description: "Carrier company name (the trucking company that will haul the load)",
                },
                totalRate: { type: "number", description: "Total rate/payment amount in USD" },
                weight: { type: "number", description: "Weight in lbs" },
                miles: { type: "number", description: "Total miles if shown in document" },
                stops: {
                  type: "array",
                  description: "All pickup and delivery stops in route order",
                  items: {
                    type: "object",
                    properties: {
                      stopType: {
                        type: "string",
                        enum: ["pickup", "delivery"],
                        description: "Whether this is a pickup or delivery stop",
                      },
                      address: {
                        type: "string",
                        description: "Physical address only (street, city, state, zip) — no company name",
                      },
                      date: {
                        type: "string",
                        description: "Date for this stop in YYYY-MM-DD format, empty if not found",
                      },
                    },
                    required: ["stopType", "address"],
                  },
                },
              },
              required: ["referenceNumber", "brokerClient", "totalRate", "weight", "stops"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "extract_load_data" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: finalBase64,
                },
              },
              {
                type: "text",
                text: `You are a data extraction assistant for a trucking/logistics company.
Extract ALL stops from this rate confirmation or BOL document.
For each stop address, extract ONLY the physical address (street, city, state, zip). Do NOT include company name or facility name.
Example: Instead of "ABC Warehouse - 123 Main St, Houston, TX 77001", return "123 Main St, Houston, TX 77001".
Return stops in route order (first pickup first, last delivery last).
If a field cannot be found, use empty string or 0 for numbers.
Dates must be in YYYY-MM-DD format.
Extract all load/shipment information including ALL pickup and delivery stops.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ error: "Error al procesar el PDF con IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    console.log("Claude response received");

    // Claude retorna tool_use en content
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse) {
      console.error("No tool_use in Claude response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "No se pudo extraer información del PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractedData = toolUse.input;
    console.log("Extracted data:", JSON.stringify(extractedData));

    const stops = extractedData.stops || [];
    const pickups = stops.filter((s: any) => s.stopType === "pickup");
    const deliveries = stops.filter((s: any) => s.stopType === "delivery");

    const result = {
      referenceNumber: extractedData.referenceNumber || "",
      brokerClient: extractedData.brokerClient || "",
      carrierName: extractedData.carrierName || "",
      totalRate: extractedData.totalRate || 0,
      weight: extractedData.weight || 0,
      miles: extractedData.miles || 0,
      origin: pickups[0]?.address || "",
      destination: deliveries[deliveries.length - 1]?.address || "",
      pickupDate: pickups[0]?.date || "",
      deliveryDate: deliveries[deliveries.length - 1]?.date || "",
      stops: stops.map((s: any) => ({
        stop_type: s.stopType,
        address: s.address,
        date: s.date || "",
      })),
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_BYTES   = 10 * 1024 * 1024;
const MAX_BASE64_SIZE = 13 * 1024 * 1024;

function looksLikePdf(bytes: Uint8Array): boolean {
  const needle = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const limit = Math.min(bytes.length - needle.length, 1024);
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] === needle[0] && bytes[i+1] === needle[1] &&
        bytes[i+2] === needle[2] && bytes[i+3] === needle[3] &&
        bytes[i+4] === needle[4]) return true;
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
    if (Number.isFinite(len) && len > MAX_PDF_BYTES) throw new Error("PDF too large (max 10MB)");
  }
  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_PDF_BYTES) throw new Error("PDF too large (max 10MB)");
  return new Uint8Array(buffer);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Autenticación ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No active tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Obtener PDF ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({} as any));
    const pdfBase64: string | undefined = body?.pdfBase64;
    const pdfUrl: string | undefined    = body?.pdfUrl;

    if (!pdfBase64 && !pdfUrl) {
      return new Response(JSON.stringify({ error: "PDF data is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("extract-pdf request", { mode: pdfUrl ? "url" : "base64" });

    let finalBase64 = "";

    if (pdfUrl) {
      if (!/^https?:\/\//i.test(pdfUrl)) {
        return new Response(JSON.stringify({ error: "Invalid PDF URL" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = await fetchPdfBytes(pdfUrl);
      if (!looksLikePdf(bytes)) {
        return new Response(JSON.stringify({ error: "File is not a valid PDF" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalBase64 = encodeBase64(bytes);
    } else {
      if (pdfBase64!.length > MAX_BASE64_SIZE) {
        return new Response(JSON.stringify({ error: "PDF too large (max 10MB)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const decoded = atob(pdfBase64!.slice(0, 200));
        if (!decoded.includes("%PDF-")) {
          return new Response(JSON.stringify({ error: "File is not a valid PDF" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid base64 encoding" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalBase64 = pdfBase64!;
    }

    // ── Llamada a Claude Haiku (más económico que Sonnet) ──────────────────
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending PDF to claude-haiku-4-5...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // Haiku: ~20x más barato que Sonnet
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
                totalRate:  { type: "number", description: "Total rate/payment amount in USD" },
                weight:     { type: "number", description: "Weight in lbs" },
                miles:      { type: "number", description: "Total miles if shown in document" },
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
                        description: "Physical address only (street, city, state, zip) - no company name",
                      },
                      date: {
                        type: "string",
                        description: "Date for this stop in YYYY-MM-DD format, empty if not found",
                      },
                      shipper: {
                        type: "string",
                        description: "Company or person name shipping/sending the cargo at this pickup stop. Empty string if not a pickup or not found.",
                      },
                      consignee: {
                        type: "string",
                        description: "Company or person name receiving the cargo at this delivery stop. Empty string if not a delivery or not found.",
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

STOP TYPES: Stops labeled PU, PU1, PU 1, PICK, PICKUP, or similar = pickup. Stops labeled SO, SO2, DEL, DELIVERY, DROP, or similar = delivery.

FOR EACH STOP, extract the company/facility name as Shipper (pickup) or Consignee (delivery). Look for:
- Explicit labels: "Name: Midwest Service Center", "Shipper: ABC Corp", "Ship From: XYZ"
- Names above or near the address without a label: "LANE WYTHEVILLE\n510 Kents Lane..."
- Company names at the beginning of a stop block
- Warehouse, plant, or distribution center names
NEVER leave shipper/consignee empty if ANY company or facility name appears in the stop block.

For the address field: extract ONLY the physical address (street number, street name, city, state, zip). Never include the company name in the address field.

Examples:
- "Name: Midwest Service Center\nAddress: 408 S. Shelby Street, Hobart IN 46342" → shipper="Midwest Service Center", address="408 S. Shelby Street, Hobart, IN 46342"
- "LANE WYTHEVILLE\n510 Kents Lane\nWYTHEVILLE, VA 24382" → shipper="LANE WYTHEVILLE", address="510 Kents Lane, Wytheville, VA 24382"
- "Name: Paragon\n5775 E 10 Mile Rd, Warren MI 48091" → consignee="Paragon", address="5775 E 10 Mile Rd, Warren, MI 48091"

Return stops in route order (pickups first, deliveries last).
Dates must be in YYYY-MM-DD format. If not found, use empty string or 0 for numbers.`,
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: "Error al procesar el PDF con IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    console.log("Claude Haiku response received");

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse) {
      console.error("No tool_use in Claude response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "No se pudo extraer informacion del PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractedData = toolUse.input;
    console.log("Extracted data:", JSON.stringify(extractedData));

    // ── Formatear resultado ────────────────────────────────────────────────
    const stops      = extractedData.stops || [];
    const pickups    = stops.filter((s: any) => s.stopType === "pickup");
    const deliveries = stops.filter((s: any) => s.stopType === "delivery");

    const result = {
      referenceNumber: extractedData.referenceNumber || "",
      brokerClient:    extractedData.brokerClient    || "",
      carrierName:     extractedData.carrierName     || "",
      totalRate:       extractedData.totalRate       || 0,
      weight:          extractedData.weight          || 0,
      miles:           extractedData.miles           || 0,
      origin:          pickups[0]?.address           || "",
      destination:     deliveries[deliveries.length - 1]?.address || "",
      pickupDate:      pickups[0]?.date              || "",
      deliveryDate:    deliveries[deliveries.length - 1]?.date    || "",
      stops: stops.map((s: any) => ({
        stop_type: s.stopType,
        address:   s.address,
        date:      s.date || "",
        shipper:   s.shipper || "",
        consignee: s.consignee || "",
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

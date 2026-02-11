import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_SIZE = 13 * 1024 * 1024; // ~13MB base64 ≈ 10MB PDF

function extractProviderErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message || parsed?.message || parsed?.error;
    return typeof msg === "string" && msg.trim() ? msg : raw;
  } catch {
    return raw;
  }
}

function looksLikePdf(bytes: Uint8Array): boolean {
  // Be tolerant: some PDFs might have whitespace/newlines before the header.
  const scanLimit = Math.min(bytes.length, 1024);
  const needle = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

  for (let i = 0; i <= scanLimit - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) {
        ok = false;
        break;
      }
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
      // Consume body to avoid leaks
      await resp.arrayBuffer().catch(() => null);
      throw new Error("PDF too large (max 10MB)");
    }
  }

  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF too large (max 10MB)");
  }

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to active tenant
    const { data: profile } = await supabaseClient
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

    // Build a data URL for Gemini.
    // NOTE: The AI gateway only supports URL inputs for images (png/jpg/webp/gif).
    // For PDFs we MUST use a data URL with MIME type.
    let documentUrl = "";

    if (pdfUrl && typeof pdfUrl === "string") {
      if (!/^https?:\/\//i.test(pdfUrl)) {
        return new Response(JSON.stringify({ error: "Invalid PDF URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (pdfUrl.length > 8192) {
        return new Response(JSON.stringify({ error: "PDF URL too long" }), {
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

      const base64 = encodeBase64(bytes);
      documentUrl = `data:application/pdf;base64,${base64}`;
    } else {
      if (pdfBase64.length > MAX_BASE64_SIZE) {
        return new Response(JSON.stringify({ error: "PDF too large (max 10MB)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate base64 format and PDF magic number
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

      documentUrl = `data:application/pdf;base64,${pdfBase64}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing PDF for data extraction with multi-stop support...");

    const systemPrompt = `You are a data extraction assistant for a trucking/logistics company. 
You will receive a PDF document (rate confirmation, BOL, or similar). 
Extract ALL stops from the document — there may be multiple pickup locations and multiple delivery locations.
For each stop address, extract ONLY the physical address (street, city, state, zip). Do NOT include the company name, facility name, or stop label in the address field.
Example: Instead of "ABC Warehouse - 123 Main St, Houston, TX 77001", just return "123 Main St, Houston, TX 77001".
If only city and state are available, return "City, ST" format.
Return stops in route order (first pickup first, last delivery last).
If a field cannot be found, leave it as an empty string or 0 for numbers.
Dates should be in YYYY-MM-DD format.
For weight, extract the numeric value in lbs.
IMPORTANT: Look carefully for ALL stops — some documents have multiple pickup and/or delivery locations listed as "Stop 1", "Stop 2", etc. or as separate sections.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Extract all load/shipment information from this PDF document, including ALL pickup and delivery stops.",
              },
              {
                type: "image_url",
                image_url: {
                  url: documentUrl,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_load_data",
              description: "Extract structured load/shipment data from a document, including all stops",
              parameters: {
                type: "object",
                properties: {
                  referenceNumber: {
                    type: "string",
                    description: "Reference number, confirmation number, or load number",
                  },
                  brokerClient: { type: "string", description: "Broker or client company name" },
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
                        address: { type: "string", description: "Full address or city, state of the stop" },
                        date: {
                          type: "string",
                          description: "Date for this stop in YYYY-MM-DD format, empty if not found",
                        },
                      },
                      required: ["stopType", "address"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["referenceNumber", "brokerClient", "totalRate", "weight", "stops"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_load_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const providerMsg = extractProviderErrorMessage(errorText);
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados. Agrega fondos en Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          error: providerMsg || "Error al procesar el PDF con IA",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    console.log("AI response received");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "No se pudo extraer información del PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted data:", JSON.stringify(extractedData));

    // Derive origin/destination from stops for backward compatibility
    const stops = extractedData.stops || [];
    const pickups = stops.filter((s: any) => s.stopType === "pickup");
    const deliveries = stops.filter((s: any) => s.stopType === "delivery");

    const result = {
      referenceNumber: extractedData.referenceNumber || "",
      brokerClient: extractedData.brokerClient || "",
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

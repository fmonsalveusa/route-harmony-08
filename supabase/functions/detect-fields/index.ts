import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageData, pageNumber, totalPages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a document field detector. Analyze document images and identify where form fields should be placed for signing/filling. Return field positions as percentages of the page dimensions. Only use these field types: signature, name, date, address, phone, email, company, jobTitle, shortText, longText, initials, notes, number.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this document page (page ${pageNumber} of ${totalPages}). Identify all areas where a person would need to fill in information or sign. For each field, determine the type and position. Return the fields as JSON.`
              },
              {
                type: "image_url",
                image_url: { url: imageData }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "detect_fields",
              description: "Return detected form fields with their positions on the document page",
              parameters: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["signature", "name", "date", "address", "phone", "email", "company", "jobTitle", "shortText", "longText", "initials", "notes", "number"] },
                        x: { type: "number", description: "X position as percentage (0-100) from left" },
                        y: { type: "number", description: "Y position as percentage (0-100) from top" },
                        width: { type: "number", description: "Width as percentage (5-50)" },
                        height: { type: "number", description: "Height as percentage (2-10)" },
                        label: { type: "string", description: "Brief description of what this field is for" }
                      },
                      required: ["type", "x", "y", "width", "height"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["fields"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "detect_fields" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-fields error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

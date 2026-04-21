import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageData, pageNumber, totalPages } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Extraer base64 y mimeType del data URL
    const base64Data = imageData.includes(",") ? imageData.split(",")[1] : imageData;
    const mimeType = imageData.startsWith("data:") ? imageData.split(";")[0].split(":")[1] : "image/jpeg";
    const validMime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType) ? mimeType : "image/jpeg";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        tools: [
          {
            name: "detect_fields",
            description: "Return detected form fields with their positions on the document page",
            input_schema: {
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
                      label: { type: "string", description: "Brief description of what this field is for" },
                    },
                    required: ["type", "x", "y", "width", "height"],
                  },
                },
              },
              required: ["fields"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "detect_fields" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: validMime,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `Analyze this document page (page ${pageNumber} of ${totalPages}). Identify all areas where a person would need to fill in information or sign. Only use these field types: signature, name, date, address, phone, email, company, jobTitle, shortText, longText, initials, notes, number. For each field, determine the type and position as percentages of the page dimensions.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Claude API error:", response.status, t);
      throw new Error("Claude API error");
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse) throw new Error("No tool_use in response");

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-fields error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

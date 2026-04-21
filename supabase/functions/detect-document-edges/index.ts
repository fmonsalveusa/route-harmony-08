import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_CORNERS = {
  corners: {
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
  },
  detected: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const mimeType = image.startsWith("data:") ? image.split(";")[0].split(":")[1] : "image/jpeg";
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
        max_tokens: 512,
        tools: [
          {
            name: "detect_corners",
            description: "Return the 4 corner coordinates of the document detected in the image",
            input_schema: {
              type: "object",
              properties: {
                corners: {
                  type: "object",
                  properties: {
                    topLeft: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                    topRight: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                    bottomRight: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                    bottomLeft: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                  },
                  required: ["topLeft", "topRight", "bottomRight", "bottomLeft"],
                },
              },
              required: ["corners"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "detect_corners" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: validMime, data: base64Data },
              },
              {
                type: "text",
                text: "Detect the 4 corners of the document/paper visible in this photo. Return coordinates as values between 0 and 1, representing percentage positions (0=left/top, 1=right/bottom). If no document is detected, return default 5% margin corners.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status, await response.text());
      return new Response(JSON.stringify(DEFAULT_CORNERS), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (toolUse?.input) {
      return new Response(JSON.stringify({ ...toolUse.input, detected: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(DEFAULT_CORNERS), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("detect-document-edges error:", e);
    return new Response(JSON.stringify({ ...DEFAULT_CORNERS, error: e instanceof Error ? e.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

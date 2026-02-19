import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Strip data URL prefix if present
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const mimeType = image.startsWith("data:") ? image.split(";")[0].split(":")[1] : "image/jpeg";

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
            content: `You are a document edge detection assistant. Given a photo, identify the 4 corners of the paper/document visible in the image. Return ONLY a JSON object with this exact structure, no other text:
{"corners":{"topLeft":{"x":0.1,"y":0.1},"topRight":{"x":0.9,"y":0.1},"bottomRight":{"x":0.9,"y":0.9},"bottomLeft":{"x":0.1,"y":0.9}}}
All x and y values must be between 0 and 1, representing percentage positions relative to the image dimensions (0=left/top, 1=right/bottom).
If you cannot detect a document, return default corners at 5% margins:
{"corners":{"topLeft":{"x":0.05,"y":0.05},"topRight":{"x":0.95,"y":0.05},"bottomRight":{"x":0.95,"y":0.95},"bottomLeft":{"x":0.05,"y":0.95}}}`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
              {
                type: "text",
                text: "Detect the 4 corners of the document in this photo. Return only the JSON coordinates.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "detect_corners",
              description: "Return the 4 corner coordinates of the document detected in the image",
              parameters: {
                type: "object",
                properties: {
                  corners: {
                    type: "object",
                    properties: {
                      topLeft: {
                        type: "object",
                        properties: { x: { type: "number" }, y: { type: "number" } },
                        required: ["x", "y"],
                      },
                      topRight: {
                        type: "object",
                        properties: { x: { type: "number" }, y: { type: "number" } },
                        required: ["x", "y"],
                      },
                      bottomRight: {
                        type: "object",
                        properties: { x: { type: "number" }, y: { type: "number" } },
                        required: ["x", "y"],
                      },
                      bottomLeft: {
                        type: "object",
                        properties: { x: { type: "number" }, y: { type: "number" } },
                        required: ["x", "y"],
                      },
                    },
                    required: ["topLeft", "topRight", "bottomRight", "bottomLeft"],
                  },
                },
                required: ["corners"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "detect_corners" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return default corners on AI error
      return new Response(
        JSON.stringify({
          corners: {
            topLeft: { x: 0.05, y: 0.05 },
            topRight: { x: 0.95, y: 0.05 },
            bottomRight: { x: 0.95, y: 0.95 },
            bottomLeft: { x: 0.05, y: 0.95 },
          },
          detected: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ ...parsed, detected: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing from content
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*"corners"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify({ ...parsed, detected: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default fallback
    return new Response(
      JSON.stringify({
        corners: {
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 },
        },
        detected: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("detect-document-edges error:", e);
    return new Response(
      JSON.stringify({
        corners: {
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 },
        },
        detected: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

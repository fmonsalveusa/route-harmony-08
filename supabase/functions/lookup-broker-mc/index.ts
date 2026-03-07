import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { broker_name } = await req.json();
    if (!broker_name || typeof broker_name !== "string") {
      return new Response(JSON.stringify({ error: "broker_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FMCSA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FMCSA API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoded = encodeURIComponent(broker_name.trim());
    const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/name/${encoded}?webKey=${apiKey}`;

    const fmcsaRes = await fetch(url);
    if (!fmcsaRes.ok) {
      const body = await fmcsaRes.text();
      console.error("FMCSA API error:", fmcsaRes.status, body);
      return new Response(JSON.stringify({ error: "FMCSA API error", mc_number: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmcsaData = await fmcsaRes.json();

    // The FMCSA API returns { content: [ { carrier: { ...fields } } ] }
    const carriers = fmcsaData?.content;
    if (!carriers || !Array.isArray(carriers) || carriers.length === 0) {
      return new Response(JSON.stringify({ mc_number: null, dot_number: null, legal_name: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const first = carriers[0]?.carrier || carriers[0];
    const mcNumber = first.mcNumber || first.mc_number || first.mcNum || null;
    const dotNumber = first.dotNumber || first.dot_number || first.dotNum || null;
    const legalName = first.legalName || first.legal_name || null;

    return new Response(
      JSON.stringify({
        mc_number: mcNumber ? String(mcNumber) : null,
        dot_number: dotNumber ? String(dotNumber) : null,
        legal_name: legalName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("lookup-broker-mc error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

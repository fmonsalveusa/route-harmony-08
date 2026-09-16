import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// EIA — On-Highway Diesel Fuel Retail Price, semanal (publica los lunes)
const SERIES: Record<string, string> = {
  national: "EMD_EPD2D_PTE_NUS_DPG",
  lower_atlantic: "EMD_EPD2D_PTE_R1Z_DPG",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Autorizado si viene del cron (secreto) o de un usuario logueado (botón "Actualizar")
  const cronSecret = Deno.env.get("CRON_SECRET");
  const fromCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!fromCron) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("EIA_API_KEY");
  if (!apiKey) return json({ error: "EIA_API_KEY not configured" }, 500);

  try {
    const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("frequency", "weekly");
    url.searchParams.append("data[0]", "value");
    Object.values(SERIES).forEach((s) => url.searchParams.append("facets[series][]", s));
    url.searchParams.set("sort[0][column]", "period");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("length", "8");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const payload = await res.json();
    const rows: any[] = payload?.response?.data ?? [];

    const results: Record<string, { period: string; price: number }> = {};
    for (const [region, series] of Object.entries(SERIES)) {
      const latest = rows.find((r) => r.series === series && r.value != null);
      if (!latest) continue;
      const price = Number(latest.value);
      if (!Number.isFinite(price) || price <= 0) continue;
      results[region] = { period: latest.period, price };

      await supabase
        .from("diesel_prices")
        .upsert({ period: latest.period, region, price, source: "eia" }, { onConflict: "period,region" });

      // Cada tenant toma el precio de su región — pisa también los valores manuales
      await supabase
        .from("tenants")
        .update({
          diesel_price_per_gallon: price,
          diesel_price_source: "eia",
          diesel_price_updated_at: latest.period,
        })
        .eq("diesel_price_region", region);
    }

    if (Object.keys(results).length === 0) throw new Error("EIA returned no diesel prices");

    console.log("Diesel prices updated:", results);
    return json({ success: true, prices: results });
  } catch (e) {
    console.error("update-diesel-price error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

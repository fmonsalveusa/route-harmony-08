// Recibe la ubicación que el plugin nativo (@capgo/background-geolocation, opción `url`)
// envía por POST directo desde Android/iOS, aun con la app en segundo plano o cerrada.
// El driver se identifica con su gps_token en la URL: /functions/v1/gps-ping?t=<token>
// Cuerpo: { latitude, longitude, accuracy, speed, bearing, time, simulated, source: 'native' }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Cache del token → driver dentro de la misma instancia (evita una consulta por ping)
const driverCache = new Map<string, { id: string; tenant_id: string; at: number }>();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const token = new URL(req.url).searchParams.get('t') || '';
  if (!UUID_RE.test(token)) return json(401, { error: 'token' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'body' }); }

  const lat = Number(body?.latitude), lng = Number(body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return json(400, { error: 'coords' });
  }
  // Ubicaciones simuladas (apps de GPS falso) no se guardan
  if (body?.simulated === true) return json(200, { ok: true, skipped: 'simulated' });

  let driver = driverCache.get(token);
  if (!driver || Date.now() - driver.at > 10 * 60 * 1000) {
    const { data, error } = await supabase.from('drivers').select('id, tenant_id').eq('gps_token', token).maybeSingle();
    if (error) return json(500, { error: 'lookup' });
    if (!data) return json(401, { error: 'token' });
    driver = { id: data.id, tenant_id: data.tenant_id, at: Date.now() };
    driverCache.set(token, driver);
  }

  // Hora del fix: la del GPS si es razonable, si no la del servidor
  const now = Date.now();
  const t = Number(body?.time);
  const fixMs = Number.isFinite(t) && t > now - 6 * 3600_000 && t < now + 120_000 ? Math.min(t, now) : now;

  // No pisar una ubicación más nueva (los POST pueden llegar desordenados al recuperar señal)
  const { data: cur } = await supabase.from('driver_locations').select('updated_at').eq('driver_id', driver.id).maybeSingle();
  if (cur?.updated_at && new Date(cur.updated_at).getTime() > fixMs + 1000) {
    return json(200, { ok: true, skipped: 'older' });
  }

  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const { error } = await supabase.from('driver_locations').upsert({
    driver_id: driver.id,
    tenant_id: driver.tenant_id,
    lat, lng,
    speed: num(body?.speed),
    heading: num(body?.bearing),
    accuracy: num(body?.accuracy),
    source: 'gps',
    updated_at: new Date(fixMs).toISOString(),
  }, { onConflict: 'driver_id' });
  if (error) {
    console.error('[gps-ping] upsert failed', error.message);
    return json(500, { error: 'upsert' });
  }
  return json(200, { ok: true });
});

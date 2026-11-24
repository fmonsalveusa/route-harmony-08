// deno-lint-ignore-file no-explicit-any
// Motive (antes KeepTruckin) SIN API key: se entra al portal con el usuario y contraseña de la flota,
// igual que en el navegador, y se lee el mapa de Fleet View.
//  1) GET  account.gomotive.com/log-in        → redirige a auth.gomotive.com/login/lookup (form con email)
//  2) POST auth.gomotive.com/login/authenticate (email)            → página de contraseña
//  3) POST auth.gomotive.com/login/authenticate (email + password) → OAuth → account.gomotive.com → cookie de sesión
//  4) Con esa sesión: GET api.keeptruckin.com/api/w2/fleet/grid_markers (header X-Web-User-Auth)
// La sesión se guarda en eld_session_cache (solo service role) para no iniciar sesión en cada lectura.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const API = "https://api.keeptruckin.com";

/** Jar de cookies mínimo (por dominio) para seguir las redirecciones del login */
class Jar {
  private c: { name: string; value: string; domain: string }[] = [];
  store(res: Response, url: string) {
    const host = new URL(url).hostname;
    const list: string[] = (res.headers as any).getSetCookie?.() ?? [];
    for (const raw of list) {
      const [pair, ...attrs] = raw.split(";");
      const i = pair.indexOf("=");
      if (i < 1) continue;
      const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
      const dAttr = attrs.map((a) => a.trim()).find((a) => /^domain=/i.test(a));
      const domain = dAttr ? dAttr.split("=")[1].replace(/^\./, "").toLowerCase() : host;
      this.c = this.c.filter((x) => !(x.name === name && x.domain === domain));
      if (value && !/expires=Thu, 01 Jan 1970/i.test(raw)) this.c.push({ name, value, domain });
    }
  }
  header(url: string) {
    const host = new URL(url).hostname;
    return this.c.filter((x) => host === x.domain || host.endsWith("." + x.domain)).map((x) => `${x.name}=${x.value}`).join("; ");
  }
  all() { return this.c; }
}

async function go(jar: Jar, url: string, init: RequestInit = {}, maxHops = 12): Promise<{ res: Response; url: string; body: string }> {
  let cur = url, method = init.method ?? "GET", body = init.body;
  for (let hop = 0; hop < maxHops; hop++) {
    const headers: Record<string, string> = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", ...(init.headers as any) };
    const ck = jar.header(cur);
    if (ck) headers.Cookie = ck;
    if (method === "POST") { headers["Content-Type"] = "application/x-www-form-urlencoded"; headers.Origin = new URL(cur).origin; }
    const res = await fetch(cur, { method, headers, body: method === "POST" ? body : undefined, redirect: "manual" });
    jar.store(res, cur);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      cur = new URL(loc, cur).href;
      method = "GET"; body = undefined;
      continue;
    }
    return { res, url: cur, body: await res.text() };
  }
  throw new Error("Motive: demasiadas redirecciones en el login");
}

function formFields(html: string, formId: string): Record<string, string> {
  const start = html.indexOf(`id="${formId}"`);
  if (start < 0) return {};
  const end = html.indexOf("</form>", start);
  const part = html.slice(start, end < 0 ? undefined : end);
  const out: Record<string, string> = {};
  for (const m of part.matchAll(/<input[^>]*>/g)) {
    const name = m[0].match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
    out[name] = value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return out;
}

async function validToken(token: string): Promise<boolean> {
  const r = await fetch(`${API}/api/w2/sessions/validate`, { headers: { "X-Web-User-Auth": token, Accept: "application/json", "User-Agent": UA } });
  await r.body?.cancel();
  return r.ok;
}

/** Inicia sesión en Motive con usuario y contraseña. Devuelve el token de sesión web. */
export async function motiveLogin(email: string, password: string): Promise<string> {
  const jar = new Jar();
  const p1 = await go(jar, "https://account.gomotive.com/log-in");
  const f1 = formFields(p1.body, "sign-in-page-form");
  if (!f1.authenticity_token) throw new Error("Motive: no se encontró el formulario de inicio de sesión");
  // Paso 1: email
  const p2 = await go(jar, new URL("/login/authenticate", p1.url).href, {
    method: "POST", body: new URLSearchParams({ ...f1, email }).toString(),
  });
  const f2 = formFields(p2.body, "sign-in-page-form");
  if (!("user_profile[password]" in f2)) {
    if (/sso|single sign/i.test(p2.body) && !/type="password"/.test(p2.body)) throw new Error("Motive: esta cuenta entra con SSO, no con contraseña");
    throw new Error("Motive: no apareció la pantalla de contraseña (¿email correcto?)");
  }
  // Paso 2: contraseña
  const p3 = await go(jar, new URL("/login/authenticate", p2.url).href, {
    method: "POST",
    body: new URLSearchParams({ ...f2, "user_profile[email]": f2["user_profile[email]"] || email, "user_profile[password]": password }).toString(),
  });
  if (/id="sign-in-page-form"/.test(p3.body) && /type="password"/.test(p3.body)) throw new Error("Motive: usuario o contraseña incorrectos");
  if (/verification code|two-factor|2-step|one-time|otp/i.test(p3.body) && !/gomotive\.com\/en-US/.test(p3.url)) {
    throw new Error("Motive pide código de verificación (2FA): desactívalo para ese usuario o usa API key");
  }
  // El token de sesión queda en una cookie; se prueba cada candidata contra sessions/validate
  const cands = jar.all().filter((c) => c.value.length >= 20 && c.value.length <= 400 && /auth|token|session|kt|user/i.test(c.name))
    .sort((a, b) => Number(/auth/i.test(b.name)) - Number(/auth/i.test(a.name)));
  for (const c of cands) {
    const v = decodeURIComponent(c.value);
    if (await validToken(v)) return v;
  }
  throw new Error(`Motive: el login no devolvió una sesión válida (llegó a ${new URL(p3.url).host}${new URL(p3.url).pathname})`);
}

/** Token de sesión de Motive del driver, reusando el guardado mientras siga válido */
export async function motiveSession(supabase: any, driverId: string, email: string, password: string, force = false): Promise<string> {
  if (!force) {
    const { data } = await supabase.from("eld_session_cache").select("token").eq("driver_id", driverId).maybeSingle();
    if (data?.token) return data.token;
  }
  const token = await motiveLogin(email, password);
  await supabase.from("eld_session_cache").upsert({ driver_id: driverId, provider: "motive", token, updated_at: new Date().toISOString() }, { onConflict: "driver_id" });
  return token;
}

export interface MotiveVehicle { unit: string; vin: string | null; driver: string | null; lat: number; lng: number; at: number; state: string | null; address: string | null; speedMph: number | null }

async function gridMarkers(token: string): Promise<{ ok: boolean; status: number; list: MotiveVehicle[] }> {
  // Todo EE. UU. y Canadá en un solo cuadro
  const q = new URLSearchParams({ top_lat: "60", top_lon: "-140", bot_lat: "20", bot_lon: "-60", limit: "500" });
  for (const inc of ["motion_details", "driver_company_id", "asset_details"]) q.append("include[]", inc);
  const r = await fetch(`${API}/api/w2/fleet/grid_markers?${q}`, { headers: { "X-Web-User-Auth": token, Accept: "application/json, text/plain, */*", "User-Agent": UA } });
  if (!r.ok) { await r.body?.cancel(); return { ok: false, status: r.status, list: [] }; }
  const j = await r.json().catch(() => ({}));
  const groups: any[] = j?.map?.travel_groups ?? [];
  const list = groups.flatMap((g) => {
    const lat = Number(g.lat), lng = Number(g.lon);
    if (!lat || !lng) return [];
    const mph = Number(g.motion_details?.speed ?? g.speed);
    return [{
      unit: String(g.vehicle_label ?? ""), vin: g.vin ?? null, driver: g.driver_label ?? null, lat, lng,
      at: Date.parse(g.located_at) || Date.now(), state: g.entity_state ?? null, address: g.address ?? null,
      speedMph: Number.isFinite(mph) ? mph : null,
    }];
  });
  return { ok: true, status: r.status, list };
}

/** Vehículos de la cuenta de Motive con su última posición. Reintenta con login nuevo si la sesión venció. */
export async function motiveVehicles(supabase: any, driverId: string, email: string, password: string): Promise<MotiveVehicle[]> {
  let token = await motiveSession(supabase, driverId, email, password);
  let r = await gridMarkers(token);
  if (!r.ok && (r.status === 401 || r.status === 403)) {
    token = await motiveSession(supabase, driverId, email, password, true);
    r = await gridMarkers(token);
  }
  if (!r.ok) throw new Error(`Motive fleet map HTTP ${r.status}`);
  return r.list;
}

export interface MotiveDriverHos {
  name: string; unit: string | null; duty: string | null; reportedAt: string | null;
  /** Segundos que le quedan en cada reloj (los calcula Motive) */
  drive: number | null; shift: number | null; cycle: number | null; untilBreak: number | null;
}

async function usersPage(token: string, page: number) {
  const q = new URLSearchParams({ per_page: "100", page_no: String(page), sort_field: "full_name", sort_direction: "asc", role: "driver", status: "active" });
  return await fetch(`${API}/api/w3/users?${q}`, { headers: { "X-Web-User-Auth": token, Accept: "application/json, text/plain, */*", "User-Agent": UA } });
}

/** Drivers de la cuenta de Motive con sus relojes HOS (lista de drivers de Fleet View) */
export async function motiveDriversHos(supabase: any, driverId: string, email: string, password: string): Promise<MotiveDriverHos[]> {
  let token = await motiveSession(supabase, driverId, email, password);
  let r = await usersPage(token, 1);
  if (r.status === 401 || r.status === 403) {
    await r.body?.cancel();
    token = await motiveSession(supabase, driverId, email, password, true);
    r = await usersPage(token, 1);
  }
  if (!r.ok) { await r.body?.cancel(); throw new Error(`Motive drivers HTTP ${r.status}`); }
  const j = await r.json().catch(() => ({}));
  const users: any[] = (j?.users ?? []).map((u: any) => u?.user ?? u);
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return users.map((u) => {
    const h = u.hos_availability_times_seconds ?? {};
    return {
      name: [u.first_name, u.last_name].filter(Boolean).join(" "),
      unit: u.current_vehicle?.number ?? null,
      duty: u.current_log_state ?? null,
      reportedAt: u.current_location?.located_at ?? null,
      drive: num(h.drive), shift: num(h.shift), cycle: num(h.cycle), untilBreak: num(h.break),
    };
  });
}

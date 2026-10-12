// deno-lint-ignore-file no-explicit-any
// Acceso a los portales de ELD con el usuario de flota (secretos de Supabase).
//  • HOS247: backend Feathers de apexhos (POST /authentication → JWT)
//  • RouteOne GO: GraphQL (mutation Login → token)

export interface EldCreds { user: string; password: string }

/** Sin credenciales usa la cuenta de flota de la empresa (secretos); con credenciales, la del driver */
export async function hos247(creds?: EldCreds): Promise<{ get: (path: string) => Promise<any[]> }> {
  const email = creds?.user ?? Deno.env.get("HOS247_EMAIL"), password = creds?.password ?? Deno.env.get("HOS247_PASSWORD");
  if (!email || !password) throw new Error("Faltan los secretos HOS247_EMAIL / HOS247_PASSWORD");
  const base = Deno.env.get("HOS247_BASE_URL") || "https://kindzadza.apexhos.com";
  const auth = await fetch(`${base}/authentication`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "local", email, password }),
  });
  const a = await auth.json().catch(() => ({}));
  const token = a.accessToken ?? a.token;
  if (!auth.ok || !token) throw new Error(`HOS247 login HTTP ${auth.status}: ${String(a.message ?? "").slice(0, 120)}`);
  return {
    get: async (path: string) => {
      const r = await fetch(`${base}${path}`, { headers: { Authorization: token } });
      if (!r.ok) throw new Error(`HOS247 ${path} HTTP ${r.status}`);
      const j = await r.json();
      return (Array.isArray(j) ? j : j.data ?? []) as any[];
    },
  };
}

export async function routeOne(creds?: EldCreds): Promise<{ gql: (query: string, variables?: Record<string, unknown>) => Promise<any> }> {
  const login = creds?.user ?? Deno.env.get("ROUTEONE_LOGIN"), password = creds?.password ?? Deno.env.get("ROUTEONE_PASSWORD");
  if (!login || !password) throw new Error("Faltan los secretos ROUTEONE_LOGIN / ROUTEONE_PASSWORD");
  const url = "https://client.routeonego.com/api/gql";
  const call = async (query: string, variables: Record<string, unknown> = {}, token?: string) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors?.length) throw new Error(`RouteOne HTTP ${r.status}: ${String(j.errors?.[0]?.message ?? "").slice(0, 120)}`);
    return j.data;
  };
  const auth = await call(
    "mutation Login($login: String!, $password: String!) { login(data: { login: $login, password: $password }) { tokens { token } } }",
    { login, password },
  );
  const token = auth?.login?.tokens?.token;
  if (!token) throw new Error("RouteOne: el login no devolvió token");
  return { gql: (query, variables) => call(query, variables, token) };
}

export interface DriverEldConnection { driver_id: string; tenant_id: string; provider: "hos247" | "routeone"; username: string }

/** Conexiones ELD propias de los drivers, con su contraseña (Vault). Marca el resultado de cada lectura. */
export async function driverConnections(supabase: any): Promise<(DriverEldConnection & { creds: EldCreds })[]> {
  const { data } = await supabase.from("driver_eld_connections").select("driver_id, tenant_id, provider, username").not("secret_id", "is", null);
  const out = [];
  for (const c of (data as any[]) || []) {
    const { data: password } = await supabase.rpc("eld_connection_password", { p_driver_id: c.driver_id });
    if (password) out.push({ ...c, creds: { user: c.username, password } });
  }
  return out;
}

export async function markConnection(supabase: any, driverId: string, ok: boolean, error?: string, unit?: string | null) {
  await supabase.from("driver_eld_connections").update({
    status: ok ? "ok" : "error", last_error: ok ? null : (error ?? "").slice(0, 300),
    ...(ok ? { last_ok_at: new Date().toISOString() } : {}), ...(unit ? { matched_unit: unit } : {}),
    updated_at: new Date().toISOString(),
  }).eq("driver_id", driverId);
}

// deno-lint-ignore-file no-explicit-any
// Acceso a los portales de ELD con el usuario de flota (secretos de Supabase).
//  • HOS247: backend Feathers de apexhos (POST /authentication → JWT)
//  • RouteOne GO: GraphQL (mutation Login → token)

export async function hos247(): Promise<{ get: (path: string) => Promise<any[]> }> {
  const email = Deno.env.get("HOS247_EMAIL"), password = Deno.env.get("HOS247_PASSWORD");
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

export async function routeOne(): Promise<{ gql: (query: string, variables?: Record<string, unknown>) => Promise<any> }> {
  const login = Deno.env.get("ROUTEONE_LOGIN"), password = Deno.env.get("ROUTEONE_PASSWORD");
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

const WHAPI = "https://gate.whapi.cloud";

function headers() {
  const token = Deno.env.get("WHAPI_TOKEN");
  if (!token) throw new Error("WHAPI_TOKEN not configured");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${WHAPI}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json().catch(() => ({}));
}

export function sendWhapiText(to: string, text: string) {
  return post("/messages/text", { to, body: text });
}

/** `media` puede ser una URL pública/firmada del archivo */
export function sendWhapiDocument(to: string, media: string, filename: string, caption: string) {
  return post("/messages/document", { to, media, filename, caption });
}

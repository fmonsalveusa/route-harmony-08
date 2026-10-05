const WHAPI = "https://gate.whapi.cloud";

function headers() {
  const token = Deno.env.get("WHAPI_TOKEN");
  if (!token) throw new Error("WHAPI_TOKEN not configured");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Solo se escribe a grupos: nunca a chats individuales (números desconocidos = riesgo de bloqueo) */
export const isGroupChat = (to: string) => String(to ?? "").endsWith("@g.us");

async function post(path: string, body: { to: string } & Record<string, unknown>) {
  if (!isGroupChat(body.to)) throw new Error(`Envío bloqueado: solo se envían mensajes a grupos (${body.to})`);
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

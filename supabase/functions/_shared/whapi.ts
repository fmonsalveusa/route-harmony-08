const WHAPI = "https://gate.whapi.cloud";

/** WHAPI_TOKEN = número de la operación (grupos). WHAPI_AGENT_TOKEN = número del agente de IA. */
function headers(tokenEnv = "WHAPI_TOKEN") {
  const token = Deno.env.get(tokenEnv);
  if (!token) throw new Error(`${tokenEnv} not configured`);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Solo se escribe a grupos: nunca a chats individuales (números desconocidos = riesgo de bloqueo) */
export const isGroupChat = (to: string) => String(to ?? "").endsWith("@g.us");

async function post(path: string, body: { to: string } & Record<string, unknown>, agent = false) {
  // El número de la operación solo escribe a grupos. El número del agente contesta en chat
  // directo, y solo a quien le escribió primero (lo controla whatsapp-agent).
  if (!agent && !isGroupChat(body.to)) throw new Error(`Envío bloqueado: solo se envían mensajes a grupos (${body.to})`);
  // Si la conexión con Whapi se corta antes de responder ("Connection reset", DNS…), se
  // reintenta hasta 2 veces. Un error HTTP no se reintenta: Whapi ya recibió el pedido.
  let res: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${WHAPI}${path}`, { method: "POST", headers: headers(agent ? "WHAPI_AGENT_TOKEN" : "WHAPI_TOKEN"), body: JSON.stringify(body) });
      break;
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (!res.ok) throw new Error(`Whapi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json().catch(() => ({}));
}

export function sendWhapiText(to: string, text: string) {
  return post("/messages/text", { to, body: text });
}

/** Respuesta del agente de IA desde su propio número, al chat de quien le escribió */
export function sendWhapiAgentText(to: string, text: string) {
  return post("/messages/text", { to, body: text }, true);
}

/** Muestra "escribiendo..." en el chat del agente durante unos segundos (si falla, no importa) */
export async function whapiAgentTyping(chatId: string, seconds: number) {
  try {
    await fetch(`${WHAPI}/presences/${encodeURIComponent(chatId)}`, {
      method: "PUT",
      headers: headers("WHAPI_AGENT_TOKEN"),
      body: JSON.stringify({ presence: "typing", delay: Math.round(seconds) }),
    });
  } catch {
    // solo es cosmético
  }
}

/** `media` puede ser una URL pública/firmada del archivo */
export function sendWhapiDocument(to: string, media: string, filename: string, caption: string) {
  return post("/messages/document", { to, media, filename, caption });
}

/**
 * Texto con vista previa propia del enlace (título e imagen nuestros) en vez de la que WhatsApp
 * arma sola con la primera URL. `media` es la URL pública de la imagen.
 */
export function sendWhapiLinkPreview(to: string, text: string, title: string, media: string, description?: string) {
  return post("/messages/link_preview", { to, body: text, title, media, ...(description ? { description } : {}) });
}

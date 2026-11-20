// Llamadas con Google Voice: reutiliza la pestaña de Voice que ya esté abierta en vez de abrir una nueva
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "voice-call" || !msg.url) return;
  (async () => {
    const tabs = await chrome.tabs.query({ url: "https://voice.google.com/*" });
    // Si la pestaña suena (llamada en curso), no se toca para no cortar la llamada
    const tab = tabs.find((t) => !t.audible);
    if (tab) {
      await chrome.tabs.update(tab.id, { url: msg.url, active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: msg.url });
    }
  })().catch((e) => console.error("voice-call:", e));
});

// ───────── Rating de RTS por broker ─────────
// Consulta el crédito del broker en RTS (la misma consulta que hace rtspro.com/credit) con la
// sesión de RTS abierta en este Chrome. Resultados guardados 24 h para no repetir consultas.
const RTS_API = "https://stc-debtor-service.rtspro.com/debtors/search";
const CACHE_MS = 24 * 3600 * 1000;
const CACHE_VER = 3;
let cache = null;
const loadCache = async () => cache ?? (cache = (await chrome.storage.local.get("rtsCache")).rtsCache || {});
const saveCache = () => chrome.storage.local.set({ rtsCache: cache });

const norm = (s) => String(s || "").toUpperCase()
  .replace(/\(.*?\)/g, " ")
  .replace(/&/g, " AND ")
  .replace(/[^A-Z0-9 ]/g, " ")
  .replace(/\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP|THE|DBA)\b/g, " ")
  .replace(/\s+/g, " ").trim();

// Registro principal de un MC: RTS repite el MC con variantes "(… ONLY)" para casos puntuales
const mainRecord = (list) =>
  list.find((d) => d.IsSuperDebtor === 1 && !/ONLY\)/i.test(d.name)) ||
  list.find((d) => !/ONLY\)/i.test(d.name)) || list[0];

const summarize = (d) => d && ({
  name: d.name, mc: d.mc_number || "", rating: (d.rating || d.calculatedRate || "").trim(),
  previous: (d.previousRating || "").trim(), days: d.averageDaysToPayPast60 || "",
  noBuy: !!(d.DebNoBuy && String(d.DebNoBuy).trim()), noBuyDesc: (d.DebNoBuyDesc || "").trim(),
  city: d.city, state: d.state,
});

async function token() {
  // La sesión la deja rts-session.js al abrir rtspro.com (dura ~24 h)
  const { rtsAuth } = await chrome.storage.local.get("rtsAuth");
  return rtsAuth && rtsAuth.exp > Date.now() + 30_000 ? rtsAuth.token : null;
}

// Una consulta a la vez, espaciadas, para no saturar a RTS
let queue = Promise.resolve();
const throttled = (fn) => (queue = queue.then(fn, fn).then((r) => new Promise((ok) => setTimeout(() => ok(r), 350))));

async function rtsSearch(params) {
  const tk = await token();
  if (!tk) return { error: "login" };
  const res = await fetch(`${RTS_API}?${new URLSearchParams(params)}`, {
    headers: { Accept: "application/json, text/plain, */*", Authorization: `Bearer ${tk}` },
  });
  if (res.status === 401 || res.status === 403) {
    await chrome.storage.local.remove("rtsAuth");
    return { error: "login" };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const data = await res.json();
  return { list: Array.isArray(data) ? data : data?.data || data?.results || [] };
}

const digits10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

async function byName(target, phone) {
    const r = await rtsSearch({ name: target });
    if (r.error) return r;
    const byMc = new Map();
    for (const d of r.list) {
      if (!d.mc_number || !/^\d+$/.test(d.mc_number)) continue;
      (byMc.get(d.mc_number) || byMc.set(d.mc_number, []).get(d.mc_number)).push(d);
    }
    const groups = [...byMc.values()].map(mainRecord);
    if (groups.length === 1) return { match: summarize(groups[0]) };
    // 1) Teléfono del broker en DAT igual al de RTS
    const tel = digits10(phone);
    if (tel.length === 10) {
      const byPhone = [...byMc.values()].filter((list) => list.some((d) => digits10(d.phone) === tel)).map(mainRecord);
      if (byPhone.length === 1) return { match: summarize(byPhone[0]) };
    }
    // 2) Mismo nombre (sin LLC/INC/puntos). Si hay varios, se descartan los que RTS no califica
    //    (N = sin rating, I = inactivo/insuficiente) cuando hay uno con rating.
    const exact = groups.filter((d) => norm(d.name) === target);
    if (exact.length === 1) return { match: summarize(exact[0]) };
    const rated = exact.filter((d) => /^[A-F]$/.test(String(d.rating || "").trim()));
    if (rated.length === 1) return { match: summarize(rated[0]) };
    // 3) El nombre de RTS empieza igual que el de DAT y solo uno tiene rating
    if (exact.length === 0) {
      const prefix = groups.filter((d) => norm(d.name).startsWith(target) && /^[A-F]$/.test(String(d.rating || "").trim()));
      if (prefix.length === 1) return { match: summarize(prefix[0]) };
    }
    if (groups.length === 0) return { none: true };
    return { ambiguous: groups.slice(0, 6).map(summarize) };
}

async function lookup({ mc, name, phone }) {
  await loadCache();
  const nameKey = `name:${norm(name)}`;
  const key = mc ? `mc:${mc}` : nameKey;
  // Broker ya identificado antes (por su MC en el detalle de la carga)
  const learned = !mc && phone ? cache[`${nameKey}|${digits10(phone)}`] : null;
  if (learned && Date.now() - learned.at < CACHE_MS) return learned.value;
  const hit = cache[key];
  if (hit && hit.v === CACHE_VER && Date.now() - hit.at < CACHE_MS && !(hit.value?.ambiguous && phone)) return hit.value;

  const value = await throttled(async () => {
    if (mc) {
      const r = await rtsSearch({ mcNumber: mc });
      if (r.error) return r;
      return r.list.length ? { match: summarize(mainRecord(r.list)) } : { none: true };
    }
    // Por nombre. DAT a veces junta dos nombres ("Dallas & Mavis/Greatwide"): se prueba el
    // nombre completo y luego cada parte.
    const parts = [name, ...String(name).split(/\s*\/\s*/)].map(norm).filter((p, i, a) => p.length >= 3 && a.indexOf(p) === i);
    let best = { none: true };
    for (const target of parts) {
      const res = await byName(target, phone);
      if (res.error || res.match) return res;
      if (res.ambiguous && best.none) best = res;
    }
    return best;
  });

  if (!value.error) {
    cache[key] = { at: Date.now(), v: CACHE_VER, value };
    if (value.match?.mc) cache[`mc:${value.match.mc}`] = { at: Date.now(), v: CACHE_VER, value: { match: value.match } };
    saveCache();
  }
  return value;
}

// El detalle de la carga identificó al broker por MC: se recuerda para su nombre (+ teléfono) en la lista
async function remember({ name, phone, mc }) {
  await loadCache();
  const hit = cache[`mc:${mc}`];
  if (!hit?.value?.match) return;
  const nameKey = `name:${norm(name)}`;
  cache[`${nameKey}|${digits10(phone)}`] = { at: Date.now(), value: hit.value };
  // Lo encontrado por MC en el detalle es exacto: reemplaza lo que se haya adivinado por nombre
  cache[nameKey] = { at: Date.now(), v: CACHE_VER, value: hit.value };
  saveCache();
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "rts-remember") { remember(msg).then(() => reply({ ok: true })); return true; }
  if (msg?.type !== "rts-lookup") return;
  lookup(msg).then(reply, (e) => reply({ error: String(e?.message || e) }));
  return true; // respuesta asíncrona
});

// Botón ⚙ del email en DAT: abre la configuración de la extensión
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "open-options") chrome.runtime.openOptionsPage();
});

// Email directo al broker: lo envía la función dat-broker-email de Dispatch Up con la clave del tenant
const DU_EMAIL_API = "https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/dat-broker-email";
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== "broker-email-send") return;
  (async () => {
    // La clave se sincroniza con la cuenta de Chrome (otras computadoras con el mismo perfil la reciben);
    // se mira también la local por si se guardó con una versión anterior.
    const duKey = (await chrome.storage.sync.get("duKey")).duKey || (await chrome.storage.local.get("duKey")).duKey;
    if (!duKey) return { error: "Falta la clave de Dispatch Up: ponla en ⚙ (la misma del asistente de RTS)." };
    const res = await fetch(DU_EMAIL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-assistant-key": duKey },
      body: JSON.stringify(msg.payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error || `HTTP ${res.status}` };
  })().then(reply, (e) => reply({ error: String(e?.message || e) }));
  return true;
});

// Aviso de versión nueva: compara con la que publica el TMS (dispatch-up.com/downloads/extensions.json)
const DU_UPDATE_URL = "https://www.dispatch-up.com/downloads/extensions.json";
const newer = (a, b) => {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
};
async function checkUpdate() {
  try {
    const res = await fetch(`${DU_UPDATE_URL}?t=${Date.now()}`, { cache: "no-store" });
    const info = (await res.json())?.dat;
    const current = chrome.runtime.getManifest().version;
    await chrome.storage.local.set({
      duUpdate: info?.version && newer(info.version, current)
        ? { version: info.version, url: new URL(info.url, DU_UPDATE_URL).href, current }
        : null,
    });
  } catch {}
}
chrome.runtime.onStartup.addListener(checkUpdate);
chrome.runtime.onInstalled.addListener(checkUpdate);
chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === "check-update") checkUpdate(); });

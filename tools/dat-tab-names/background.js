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

async function lookup({ mc, name }) {
  await loadCache();
  const key = mc ? `mc:${mc}` : `name:${norm(name)}`;
  const hit = cache[key];
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const value = await throttled(async () => {
    if (mc) {
      const r = await rtsSearch({ mcNumber: mc });
      if (r.error) return r;
      return r.list.length ? { match: summarize(mainRecord(r.list)) } : { none: true };
    }
    // Por nombre: RTS busca por texto; se elige el que coincide con el nombre de DAT
    const target = norm(name);
    const r = await rtsSearch({ name: target });
    if (r.error) return r;
    const byMc = new Map();
    for (const d of r.list) {
      if (!d.mc_number || !/^\d+$/.test(d.mc_number)) continue;
      (byMc.get(d.mc_number) || byMc.set(d.mc_number, []).get(d.mc_number)).push(d);
    }
    const groups = [...byMc.values()].map(mainRecord);
    const exact = groups.filter((d) => norm(d.name) === target);
    if (exact.length === 1) return { match: summarize(exact[0]) };
    if (groups.length === 1) return { match: summarize(groups[0]) };
    if (groups.length === 0) return { none: true };
    return { ambiguous: groups.slice(0, 6).map(summarize) };
  });

  if (!value.error) {
    cache[key] = { at: Date.now(), value };
    if (value.match?.mc) cache[`mc:${value.match.mc}`] = { at: Date.now(), value: { match: value.match } };
    saveCache();
  }
  return value;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== "rts-lookup") return;
  lookup(msg).then(reply, (e) => reply({ error: String(e?.message || e) }));
  return true; // respuesta asíncrona
});

// Pinta la ciudad destino de cada carga en DAT One según cómo está el mercado de SALIDA de esa
// zona (qué tan fácil es recargar ahí): índice MCI de DAT (-100 frío … +100 caliente) por zona KMA.
// Los datos los guarda iq-session.js cuando abres Market Conditions en DAT iQ. Para ubicar la
// ciudad en su zona usa las coordenadas que DAT trae en cada carga (dat-capture.js); si no las
// hay, usa el promedio del estado.
(() => {
  // Una sola mano a la derecha de la ciudad, con las bandas del mapa de DAT; el tono dice qué tanto:
  //   👍 verde oscuro ≥ +85 · verde +43…+85 · verde claro +10…+43 · ✋ azul -15…+10
  //   👎 rojo claro -25…-15 · rojo -36…-25 · rojo oscuro ≤ -36
  const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>';
  const HAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/></svg>';
  const LEVELS = [
    { min: 85, cls: "du-mkt-hot3", icon: UP, label: "muy caliente" },
    { min: 43, cls: "du-mkt-hot2", icon: UP, label: "caliente" },
    { min: 10, cls: "du-mkt-hot1", icon: UP, label: "tibio" },
    { min: -15, cls: "du-mkt-neu", icon: HAND, label: "neutral" },
    { min: -25, cls: "du-mkt-cold1", icon: DOWN, label: "fresco" },
    { min: -36, cls: "du-mkt-cold2", icon: DOWN, label: "frío" },
    { min: -Infinity, cls: "du-mkt-cold3", icon: DOWN, label: "muy frío" },
  ];
  const STALE_MS = 24 * 60 * 60 * 1000;

  let market = null; // { FLATBED: { OUT: { kma: {at, map}, state: {at, map} } } }
  let zones = []; // [{ code, name, box:[minX,minY,maxX,maxY], rings }]
  let version = 0;

  const prepZones = (s) => (s?.shapes || []).map((z) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const r of z.rings) for (let i = 0; i < r.length; i += 2) {
      if (r[i] < a) a = r[i]; if (r[i] > c) c = r[i];
      if (r[i + 1] < b) b = r[i + 1]; if (r[i + 1] > d) d = r[i + 1];
    }
    return { code: z.code, name: z.name, box: [a, b, c, d], rings: z.rings };
  });
  const load = async () => {
    try {
      const s = await chrome.storage.local.get(["duMarket", "duKmaShapes"]);
      market = s.duMarket || null;
      zones = prepZones(s.duKmaShapes);
      version++;
      schedule();
    } catch {}
  };
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && (ch.duMarket || ch.duKmaShapes)) load();
  });

  // Punto dentro de la zona (par-impar sobre todos sus anillos: sirve con huecos e islas)
  const inside = (x, y, rings) => {
    let inn = false;
    for (const r of rings) {
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
      }
    }
    return inn;
  };
  const zoneCache = new Map(); // "lat,lng" → zona
  const zoneAt = (lat, lng) => {
    const k = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (zoneCache.has(k)) return zoneCache.get(k);
    let z = zones.find((z) => lng >= z.box[0] && lng <= z.box[2] && lat >= z.box[1] && lat <= z.box[3] && inside(lng, lat, z.rings)) || null;
    // Ciudades en la costa o en el borde pueden quedar fuera de la figura simplificada:
    // se toma la zona con el borde más cercano (hasta ~40 km)
    if (!z) {
      let best = 0.4 * 0.4;
      for (const c of zones) {
        if (lng < c.box[0] - 0.4 || lng > c.box[2] + 0.4 || lat < c.box[1] - 0.4 || lat > c.box[3] + 0.4) continue;
        for (const r of c.rings) for (let i = 0; i < r.length; i += 2) {
          const dx = (r[i] - lng) * Math.cos((lat * Math.PI) / 180), dy = r[i + 1] - lat, d = dx * dx + dy * dy;
          if (d < best) { best = d; z = c; }
        }
      }
    }
    zoneCache.set(k, z);
    return z;
  };

  // Código de equipo de DAT → tipo de Market Conditions
  const equipOf = (code) => {
    const c = String(code || "").toUpperCase();
    if (c.startsWith("F") || c === "SD" || c === "DD" || c === "LB" || c === "HS") return "FLATBED";
    if (c.startsWith("R")) return "REEFER";
    return "VAN";
  };
  const pickEquip = (code) => {
    const want = equipOf(code);
    if (market?.[want]?.OUT) return want;
    return null;
  };

  // Equipo por defecto cuando la fila no lo dice: el más común entre las cargas de la búsqueda
  const defaultEquip = () => {
    const n = {};
    for (const p of postings.values()) { const e = equipOf(p.equipment); n[e] = (n[e] || 0) + 1; }
    const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
    return best && market?.[best]?.OUT ? best : market?.FLATBED?.OUT ? "FLATBED" : null;
  };

  // Volumen de la zona: qué tan arriba está en cargas frente a las demás zonas (0 = la que menos, 1 = la que más)
  const rankCache = new Map(); // `${eq}|${version}` → cargas ordenadas
  const volRank = (eq, loads) => {
    const k = `${eq}|${version}`;
    let sorted = rankCache.get(k);
    if (!sorted) {
      sorted = Object.values(market[eq].OUT.lt?.map || {}).map((v) => v[0]).filter((x) => x > 0).sort((a, b) => a - b);
      rankCache.set(k, sorted);
    }
    if (!sorted.length) return null;
    let i = 0;
    while (i < sorted.length && sorted[i] < loads) i++;
    return { rank: i / sorted.length, pos: sorted.length - i, of: sorted.length };
  };

  // MCI de salida para una carga: zona KMA por coordenadas; si no, promedio del estado
  function lookup(info, text, eqCode) {
    const eq = pickEquip(info?.equipment || eqCode) || (!info?.equipment && !eqCode ? defaultEquip() : null);
    if (!eq) return null;
    const out = market[eq].OUT;
    if (out.kma && zones.length && typeof info?.destLat === "number" && typeof info?.destLng === "number") {
      const z = zoneAt(info.destLat, info.destLng);
      const v = z && out.kma.map[z.code];
      const lt = z && out.lt?.map?.[z.code];
      if (v) return {
        mci: v[0], where: v[1] || z.name || z.code, at: out.kma.at, eq, byState: false,
        loads: lt ? lt[0] : null, trucks: lt ? lt[1] : null, vol: lt ? volRank(eq, lt[0]) : null,
      };
    }
    const st = (info?.destState || String(text).match(/,\s*([A-Z]{2})\s*$/)?.[1] || "").toUpperCase();
    if (!st) return null;
    if (out.state?.map?.[st]) return { mci: out.state.map[st][0], where: st, at: out.state.at, eq, byState: true };
    if (out.kma) {
      const vals = Object.entries(out.kma.map).filter(([c]) => c.startsWith(st + "_")).map(([, v]) => v[0]);
      if (vals.length) return { mci: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), where: st, at: out.kma.at, eq, byState: true };
    }
    return null;
  }

  const EQ_NAME = { FLATBED: "Flatbed", VAN: "Van", REEFER: "Reefer" };
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 60 ? `hace ${m} min` : m < 48 * 60 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
  };

  // La mano va a la IZQUIERDA de la ciudad: así queda siempre bajo el título "Destination"
  // (la celda de DAT es más ancha que su título y a la derecha caía bajo "DH-D").
  // Nota final = MCI (cargas por camión) limitado por el VOLUMEN de la zona: una zona con pocas
  // cargas no sale muy verde aunque DAT la marque "Very Tight" (p. ej. Idaho: 724 cargas, 23 camiones).
  // Volumen frente a las demás zonas: top 20 % → hasta verde oscuro · 20–40 % → verde ·
  // 40–65 % → verde claro · el 35 % con menos cargas → ✋ neutral.
  const TONE_LABEL = ["", "tibio", "caliente", "muy caliente"];
  function grade(r) {
    let lvl = LEVELS.find((l) => r.mci >= l.min);
    if (r.mci < 10) return { lvl, capped: false };
    let tone = r.mci >= 85 ? 3 : r.mci >= 43 ? 2 : 1;
    let cap = 3;
    if (r.vol) cap = r.vol.rank >= 0.8 ? 3 : r.vol.rank >= 0.6 ? 2 : r.vol.rank >= 0.35 ? 1 : 0;
    else if (r.byState) cap = 1; // promedio del estado: sin volumen, no más que verde claro
    const capped = cap < tone;
    tone = Math.min(tone, cap);
    lvl = tone === 0
      ? { cls: "du-mkt-neu", icon: LEVELS.find((l) => l.cls === "du-mkt-neu").icon, label: "neutral (pocas cargas)" }
      : { cls: `du-mkt-hot${tone}`, icon: LEVELS[0].icon, label: TONE_LABEL[tone] + (capped ? " (limitado por volumen)" : "") };
    return { lvl, capped };
  }

  function paint(el, r) {
    let ico = el.previousElementSibling?.classList?.contains("du-mkt-ico") ? el.previousElementSibling : null;
    if (!r) { ico?.remove(); return; }
    const { lvl } = grade(r);
    const stale = Date.now() - r.at > STALE_MS;
    if (!ico) { ico = document.createElement("span"); el.before(ico); }
    ico.className = `du-mkt-ico ${lvl.cls}${stale ? " du-mkt-stale" : ""}`;
    ico.innerHTML = lvl.icon;
    ico.title = [
      `Mercado de salida ${r.byState ? `(promedio del estado ${r.where})` : `— ${r.where}`} · ${EQ_NAME[r.eq] || r.eq}`,
      `Resultado: ${lvl.label}`,
      `MCI ${r.mci > 0 ? "+" : ""}${r.mci} (cargas por camión)`,
      r.loads != null ? `Volumen: ${r.loads.toLocaleString("en-US")} cargas · ${r.trucks} camiones — zona #${r.vol?.pos} de ${r.vol?.of} en cargas` : "",
      `Dato de DAT Market Conditions ${ago(r.at)}${stale ? " — ábrelo para actualizar" : ""}`,
    ].filter(Boolean).join("\n");
  }

  // Datos de cada carga (coordenadas del destino y equipo), por postingId — de dat-capture.js
  const postings = new Map();
  window.addEventListener("message", (e) => {
    if (e.source !== window || !Array.isArray(e.data?.__duDatPostings)) return;
    for (const p of e.data.__duDatPostings) if (p.postingId) postings.set(p.postingId, p);
    schedule();
  });
  window.postMessage({ __duDatRequest: true }, location.origin);

  function scan() {
    if (!market) return;
    for (const el of document.querySelectorAll('[data-test="load-destination-cell"]')) {
      const row = el.closest("dat-result-row");
      const pid = row?.querySelector("[posting-id]")?.getAttribute("posting-id") || "";
      const info = postings.get(pid);
      const text = (el.textContent || "").trim();
      const key = `${version}|${pid}|${text}|${info ? 1 : 0}|${row?.querySelector('[data-test="load-eq-cell"]')?.textContent || ""}`;
      if (el.dataset.duMkt === key) continue;
      el.dataset.duMkt = key;
      const eqCode = (row?.querySelector('[data-test="load-eq-cell"]')?.textContent || "").trim();
      paint(el, /anywhere/i.test(text) ? null : lookup(info, text, eqCode));
    }
  }

  let t = null;
  const schedule = () => { clearTimeout(t); t = setTimeout(scan, 300); };
  // Si la extensión se recarga/actualiza con DAT abierto, este script queda huérfano (sin acceso
  // a la extensión): se apaga solo en vez de llenar "Errores" de chrome://extensions.
  const obs = new MutationObserver(() => alive() && schedule());
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["posting-id"] });
  const iv = setInterval(() => { if (alive() && !document.hidden) scan(); }, 4000);
  function alive() { if (chrome.runtime?.id) return true; obs.disconnect(); clearInterval(iv); clearTimeout(t); return false; }
  load();
})();

// Pinta la ciudad destino de cada carga en DAT One según cómo está el mercado de SALIDA de esa
// zona (qué tan fácil es recargar ahí): índice MCI de DAT (-100 frío … +100 caliente) por zona KMA.
// Los datos los guarda iq-session.js cuando abres Market Conditions en DAT iQ. Para ubicar la
// ciudad en su zona usa las coordenadas que DAT trae en cada carga (dat-capture.js); si no las
// hay, usa el promedio del estado.
(() => {
  // Escala del mapa de DAT: ≤-36 frío · -36…-15 fresco · -15…10 neutral · 10…43 tibio · ≥43 caliente
  const LEVELS = [
    { min: 43, cls: "du-mkt-hot2", label: "caliente" },
    { min: 10, cls: "du-mkt-hot1", label: "tibio" },
    { min: -15, cls: "du-mkt-neu", label: "neutral" },
    { min: -36, cls: "du-mkt-cold1", label: "fresco" },
    { min: -Infinity, cls: "du-mkt-cold2", label: "frío" },
  ];
  const ALL_CLS = LEVELS.map((l) => l.cls).concat("du-mkt", "du-mkt-stale");
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

  // MCI de salida para una carga: zona KMA por coordenadas; si no, promedio del estado
  function lookup(info, text, eqCode) {
    const eq = pickEquip(info?.equipment || eqCode);
    if (!eq) return null;
    const out = market[eq].OUT;
    if (out.kma && zones.length && typeof info?.destLat === "number" && typeof info?.destLng === "number") {
      const z = zoneAt(info.destLat, info.destLng);
      const v = z && out.kma.map[z.code];
      if (v) return { mci: v[0], where: v[1] || z.name || z.code, at: out.kma.at, eq, byState: false };
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

  function paint(el, r) {
    el.classList.remove(...ALL_CLS);
    if (!r) { if (el.dataset.duMktTitle) { el.removeAttribute("title"); delete el.dataset.duMktTitle; } return; }
    const lvl = LEVELS.find((l) => r.mci >= l.min);
    const stale = Date.now() - r.at > STALE_MS;
    el.classList.add("du-mkt", lvl.cls);
    if (stale) el.classList.add("du-mkt-stale");
    const t = [
      `Mercado de salida ${r.byState ? `(promedio del estado ${r.where})` : `— ${r.where}`}`,
      `MCI ${r.mci > 0 ? "+" : ""}${r.mci}: ${lvl.label} · ${EQ_NAME[r.eq] || r.eq}`,
      `Dato de DAT Market Conditions ${ago(r.at)}${stale ? " — ábrelo para actualizar" : ""}`,
    ].join("\n");
    el.title = t;
    el.dataset.duMktTitle = "1";
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
  new MutationObserver(schedule)
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["posting-id"] });
  setInterval(() => { if (!document.hidden) scan(); }, 4000);
  load();
})();

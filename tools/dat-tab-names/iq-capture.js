// Corre DENTRO de Market Conditions de DAT iQ (iq.prod.dat.com, mundo MAIN). No hace consultas
// propias: solo toma lo que la página ya cargó para pintar su mapa y se lo pasa a iq-session.js:
//  - el índice de mercado (MCI, -100 frío … +100 caliente) por zona KMA / estado;
//  - las figuras de las zonas KMA (polígonos del mapa), para saber en qué zona cae cada ciudad.
(() => {
  const post = (msg) => window.postMessage(msg, location.origin);

  // ── MCI: respuestas de analyticsfacade/graphql (PocMci) ──
  const onMci = (reqBody, text) => {
    if (!text || (text.indexOf('"mci"') < 0 && text.indexOf('"lt"') < 0)) return;
    let req = {}, res;
    try { req = JSON.parse(reqBody || "{}"); } catch {}
    try { res = JSON.parse(text); } catch { return; }
    const q = req?.variables?.query || {};
    // Volumen de cada zona (PocLt: cargas y camiones de salida de hoy)
    const lt = res?.data?.lt;
    if (Array.isArray(lt) && lt.length >= 20 && (!q.timeframe || q.timeframe === "CURRENT")) {
      post({
        __duLt: {
          equipment: q.equipmentType,
          areaType: q.areaType || lt[0].type,
          rows: lt.filter((r) => r && r.code && typeof r.loads === "number")
            .map((r) => ({ code: r.code, loads: r.loads, trucks: r.trucks || 0 })),
        },
      });
      return;
    }
    const rows = res?.data?.mci;
    if (!Array.isArray(rows) || !rows.length) return;
    if (q.timeframe && q.timeframe !== "CURRENT") return; // solo el mercado de hoy
    if (rows.length < 20) return; // vista de una sola ubicación, no el mapa completo
    post({
      __duMci: {
        equipment: q.equipmentType || rows[0].equipmentType,
        direction: q.direction || rows[0].direction,
        areaType: q.areaType || rows[0].type,
        rows: rows.filter((r) => r && r.code && typeof r.mci === "number")
          .map((r) => ({ code: r.code, name: r.name || "", mci: r.mci, date: r.date || r.calculationDate || "" })),
      },
    });
  };

  const isFacade = (u) => /analytics\.api\.dat\.com\/analyticsfacade\/graphql/.test(String(u));
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__duUrl = url; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    if (isFacade(this.__duUrl)) {
      this.addEventListener("load", () => {
        try {
          const t = !this.responseType || this.responseType === "text" ? this.responseText
            : this.responseType === "json" ? JSON.stringify(this.response) : "";
          onMci(typeof body === "string" ? body : "", t);
        } catch {}
      });
    }
    return send.apply(this, arguments);
  };
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (isFacade(url)) res.clone().text().then((t) => onMci(typeof init?.body === "string" ? init.body : "", t), () => {});
    } catch {}
    return res;
  };

  // ── Figuras de las zonas KMA: las toma de la capa de datos del mapa de Google ──
  const layers = new Set();
  let shapesSent = 0, timer = null;
  const round = (n) => Math.round(n * 100) / 100; // ~1 km, suficiente para ubicar una ciudad
  const ringOf = (ring) => {
    const out = [];
    let pl = null, pg = null;
    ring.getArray().forEach((ll) => {
      const x = round(ll.lng()), y = round(ll.lat());
      if (x !== pl || y !== pg) { out.push(x, y); pl = x; pg = y; }
    });
    return out.length >= 6 ? out : null;
  };
  const ringsOf = (g) => {
    if (!g) return [];
    const t = g.getType();
    if (t === "Polygon") return g.getArray().map(ringOf).filter(Boolean);
    if (t === "MultiPolygon") return g.getArray().flatMap((p) => p.getArray().map(ringOf).filter(Boolean));
    return [];
  };
  const extract = () => {
    const byCode = new Map(); // la página tiene dos mapas con las mismas zonas
    for (const d of layers) {
      try {
        d.forEach((f) => {
          const code = String(f.getProperty("code") || f.getId() || "");
          if (!/^[A-Z]{2}_[A-Z]{3}$/.test(code) || byCode.has(code)) return; // solo zonas KMA (p. ej. TX_AUS)
          const rings = ringsOf(f.getGeometry());
          if (rings.length) byCode.set(code, { code, name: String(f.getProperty("name") || ""), rings });
        });
      } catch {}
    }
    const shapes = [...byCode.values()];
    // Se manda cuando hay un mapa KMA completo y cambió algo
    if (shapes.length >= 50 && shapes.length !== shapesSent) {
      shapesSent = shapes.length;
      post({ __duKmaShapes: shapes });
    }
  };
  const hookMaps = () => {
    const P = window.google?.maps?.Data?.prototype;
    if (!P || P.__duHooked) return !!P;
    P.__duHooked = true;
    for (const m of ["setStyle", "overrideStyle", "revertStyle", "add", "addGeoJson", "forEach", "setMap"]) {
      const o = P[m];
      if (typeof o !== "function") continue;
      P[m] = function () {
        if (!layers.has(this)) layers.add(this);
        clearTimeout(timer);
        timer = setTimeout(extract, 1500);
        return o.apply(this, arguments);
      };
    }
    return true;
  };
  const iv = setInterval(() => { if (hookMaps()) clearInterval(iv); }, 300);
})();

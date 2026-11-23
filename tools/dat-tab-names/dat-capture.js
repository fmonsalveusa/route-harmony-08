// Corre DENTRO de la página de DAT One (mundo MAIN). Cuando DAT trae los resultados de una
// búsqueda, toma de cada carga el MC/DOT del broker (DAT los trae aunque no los muestre en la
// línea) y se los pasa a rts-chip.js para que busque el rating de RTS por MC, que es exacto.
(() => {
  const all = new Map(); // postingId → { postingId, name, mc, dot }
  const num = (n) => (typeof n === "number" && isFinite(n) ? n : typeof n === "string" && n.trim() && isFinite(+n) ? +n : null);
  const place = (p) => (p ? [p.city, p.stateProv].filter(Boolean).join(", ") : "");
  const publish = (text) => {
    // Las cargas nuevas que DAT agrega solas a la lista llegan en otra consulta que a veces no trae
    // el MC (posterDotIds): se toman igual (ubicación, equipo, email…) y el MC se completa después.
    if (!text || text.indexOf("postingId") < 0) return;
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const out = [];
    const walk = (v, depth) => {
      if (!v || typeof v !== "object" || depth > 12) return;
      if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
      const pid = v.assetInfo?.postingId || (typeof v.postingId === "string" && (v.posterInfo || v.posterDotIds) ? v.postingId : null);
      if (pid && (v.posterDotIds || v.assetInfo || v.posterInfo)) {
        const d = v.posterDotIds || v.posterInfo?.dotIds || {};
        const a = v.assetInfo || {};
        out.push({
          postingId: pid,
          name: v.posterInfo?.companyName || "",
          mc: String(d.brokerMcNumber || d.carrierMcNumber || d.freightForwarderMcNumber || ""),
          dot: String(d.dotNumber || ""),
          // Datos para el email al broker
          email: v.posterInfo?.contact?.email ||
            (v.posterInfo?.contactMethods || []).map((c) => c?.value?.emailAddress).find(Boolean) || "",
          origin: place(a.origin),
          destination: place(a.destination),
          // Para pintar el mercado de la ciudad destino (market-chip.js)
          destLat: num(a.destination?.latitude ?? a.destination?.lat),
          destLng: num(a.destination?.longitude ?? a.destination?.lng ?? a.destination?.lon),
          destState: a.destination?.stateProv || "",
          dho: v.originDeadheadMiles?.miles ?? null,
          miles: v.tripLength?.miles ?? null,
          date: v.availability?.earliestWhen || "",
          equipment: a.equipmentType || "",
          weight: a.capacity?.maximumWeightPounds ?? null,
          length: a.capacity?.maximumLengthFeet ?? null,
          fullPartial: a.capacity?.fullPartial || "",
          rate: v.rateInfo?.bookable?.rateUsd ?? v.rateInfo?.nonBookable?.rateUsd ?? null,
          ref: v.postersReferenceId || "",
        });
        return;
      }
      for (const x of Object.values(v)) walk(x, depth + 1);
    };
    walk(json, 0);
    if (!out.length) return;
    // Se combina con lo que ya se sabía de esa carga: un dato que llega vacío no borra uno bueno (p. ej. el MC)
    const merged = out.map((p) => {
      const old = all.get(p.postingId);
      if (!old) return p;
      const m = { ...old };
      for (const [k, val] of Object.entries(p)) if (val !== "" && val !== null && val !== undefined) m[k] = val;
      return m;
    });
    for (const p of merged) all.set(p.postingId, p);
    window.postMessage({ __duDatPostings: merged }, location.origin);
  };
  // Lo ya capturado se reenvía cuando rts-chip.js arranca (puede cargar después de la primera búsqueda)
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.__duDatRequest) window.postMessage({ __duDatPostings: [...all.values()] }, location.origin);
  });

  const isDat = (u) => /^https:\/\/[\w.-]*\.dat\.com\//.test(String(u));

  const origFetch = window.fetch;
  window.fetch = async function (input) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input?.url || String(input || "");
      if (isDat(url)) res.clone().text().then(publish, () => {});
    } catch {}
    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__duUrl = url; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (isDat(this.__duUrl)) {
      this.addEventListener("load", () => {
        try {
          if (!this.responseType || this.responseType === "text") publish(this.responseText);
          else if (this.responseType === "json" && this.response) publish(JSON.stringify(this.response));
        } catch {}
      });
    }
    return send.apply(this, arguments);
  };
})();

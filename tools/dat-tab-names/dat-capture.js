// Corre DENTRO de la página de DAT One (mundo MAIN). Cuando DAT trae los resultados de una
// búsqueda, toma de cada carga el MC/DOT del broker (DAT los trae aunque no los muestre en la
// línea) y se los pasa a rts-chip.js para que busque el rating de RTS por MC, que es exacto.
(() => {
  const all = new Map(); // postingId → { postingId, name, mc, dot }
  const place = (p) => (p ? [p.city, p.stateProv].filter(Boolean).join(", ") : "");
  const publish = (text) => {
    if (!text || text.indexOf("posterDotIds") < 0) return;
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const out = [];
    const walk = (v, depth) => {
      if (!v || typeof v !== "object" || depth > 12) return;
      if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
      if (v.posterDotIds && v.assetInfo?.postingId) {
        const d = v.posterDotIds;
        out.push({
          postingId: v.assetInfo.postingId,
          name: v.posterInfo?.companyName || "",
          mc: String(d.brokerMcNumber || d.carrierMcNumber || d.freightForwarderMcNumber || ""),
          dot: String(d.dotNumber || ""),
          // Datos para el email al broker
          email: v.posterInfo?.contact?.email ||
            (v.posterInfo?.contactMethods || []).map((c) => c?.value?.emailAddress).find(Boolean) || "",
          origin: place(v.assetInfo.origin),
          destination: place(v.assetInfo.destination),
          dho: v.originDeadheadMiles?.miles ?? null,
          miles: v.tripLength?.miles ?? null,
          date: v.availability?.earliestWhen || "",
          equipment: v.assetInfo.equipmentType || "",
          weight: v.assetInfo.capacity?.maximumWeightPounds ?? null,
          length: v.assetInfo.capacity?.maximumLengthFeet ?? null,
          fullPartial: v.assetInfo.capacity?.fullPartial || "",
          rate: v.rateInfo?.bookable?.rateUsd ?? v.rateInfo?.nonBookable?.rateUsd ?? null,
          ref: v.postersReferenceId || "",
        });
        return;
      }
      for (const x of Object.values(v)) walk(x, depth + 1);
    };
    walk(json, 0);
    if (!out.length) return;
    for (const p of out) all.set(p.postingId, p);
    window.postMessage({ __duDatPostings: out }, location.origin);
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
      const url = typeof input === "string" ? input : input?.url;
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
        try { if (!this.responseType || this.responseType === "text") publish(this.responseText); } catch {}
      });
    }
    return send.apply(this, arguments);
  };
})();

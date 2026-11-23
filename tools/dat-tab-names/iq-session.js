// Corre en Market Conditions (iq.prod.dat.com, mundo aislado). Guarda en la extensión lo que
// iq-capture.js tomó de la página: el MCI de cada zona/estado, el volumen (cargas/camiones) de
// cada zona y las figuras de las zonas KMA. market-chip.js lo usa en DAT One para pintar la
// ciudad destino de cada carga.
(() => {
  // Las respuestas llegan casi juntas: se guardan una tras otra para no pisarse
  let chain = Promise.resolve();
  const update = (fn) => {
    chain = chain.then(async () => {
      try {
        const { duMarket = {} } = await chrome.storage.local.get("duMarket");
        fn(duMarket);
        await chrome.storage.local.set({ duMarket });
      } catch {}
    });
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const m = e.data?.__duMci;
    if (m?.equipment && m?.direction && Array.isArray(m.rows) && m.rows.length) {
      const kind = /KMA|MKT/i.test(m.areaType) ? "kma" : /STATE/i.test(m.areaType) ? "state" : null;
      if (!kind) return;
      update((duMarket) => {
        const dir = ((duMarket[m.equipment] ||= {})[m.direction] ||= {});
        const map = {};
        for (const r of m.rows) map[r.code] = [r.mci, r.name];
        dir[kind] = { at: Date.now(), date: m.rows[0].date || "", map };
      });
      return;
    }
    // Volumen de salida por zona KMA: cargas y camiones
    const l = e.data?.__duLt;
    if (l?.equipment && /KMA|MKT/i.test(l.areaType || "") && Array.isArray(l.rows) && l.rows.length) {
      update((duMarket) => {
        const dir = ((duMarket[l.equipment] ||= {}).OUT ||= {});
        const map = {};
        for (const r of l.rows) map[r.code] = [r.loads, r.trucks];
        dir.lt = { at: Date.now(), map };
      });
      return;
    }
    const s = e.data?.__duKmaShapes;
    if (Array.isArray(s) && s.length) chain = chain.then(() => chrome.storage.local.set({ duKmaShapes: { at: Date.now(), shapes: s } }).catch(() => {}));
  });
})();

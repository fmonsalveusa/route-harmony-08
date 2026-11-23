// Corre en Market Conditions (iq.prod.dat.com, mundo aislado). Guarda en la extensión lo que
// iq-capture.js tomó de la página: el MCI de cada zona/estado y las figuras de las zonas KMA.
// market-chip.js lo usa en DAT One para pintar la ciudad destino de cada carga.
(() => {
  window.addEventListener("message", async (e) => {
    if (e.source !== window) return;
    const m = e.data?.__duMci;
    if (m?.equipment && m?.direction && Array.isArray(m.rows) && m.rows.length) {
      const kind = /KMA|MKT/i.test(m.areaType) ? "kma" : /STATE/i.test(m.areaType) ? "state" : null;
      if (!kind) return;
      const { duMarket = {} } = await chrome.storage.local.get("duMarket");
      const eq = (duMarket[m.equipment] ||= {});
      const dir = (eq[m.direction] ||= {});
      const map = {};
      for (const r of m.rows) map[r.code] = [r.mci, r.name];
      dir[kind] = { at: Date.now(), date: m.rows[0].date || "", map };
      await chrome.storage.local.set({ duMarket });
      return;
    }
    const s = e.data?.__duKmaShapes;
    if (Array.isArray(s) && s.length) await chrome.storage.local.set({ duKmaShapes: { at: Date.now(), shapes: s } });
  });
})();

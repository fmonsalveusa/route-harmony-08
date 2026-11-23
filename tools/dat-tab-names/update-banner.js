// Barra en DAT cuando hay una versión nueva de la extensión publicada en el TMS
(() => {
  try { chrome.runtime.sendMessage({ type: "check-update" }).catch(() => {}); } catch {}
  const SNOOZE_KEY = "duUpdateSnooze";
  async function show() {
    const { duUpdate, [SNOOZE_KEY]: snooze } = await chrome.storage.local.get(["duUpdate", SNOOZE_KEY]);
    document.querySelector(".du-update")?.remove();
    if (!duUpdate || (snooze && snooze.version === duUpdate.version && Date.now() < snooze.until)) return;
    const bar = document.createElement("div");
    bar.className = "du-update";
    bar.innerHTML =
      `<span>Hay una versión nueva de la extensión <b>DAT Driver Tabs</b> (${duUpdate.version}; tienes ${duUpdate.current}).</span>` +
      `<a href="${duUpdate.url}" download>Descargar</a>` +
      `<span class="du-update-hint">Descomprímela encima de la carpeta actual y pulsa ↻ en chrome://extensions</span>` +
      `<button type="button" title="Recordar mañana">✕</button>`;
    bar.querySelector("button").onclick = () => {
      chrome.storage.local.set({ [SNOOZE_KEY]: { version: duUpdate.version, until: Date.now() + 24 * 3600 * 1000 } });
      bar.remove();
    };
    document.body.append(bar);
  }
  chrome.storage.onChanged.addListener((c) => { if (c.duUpdate) show(); });
  show();

  // La extensión se actualizó sola (o con ↻) con DAT abierto: esta página quedó con la versión
  // anterior desconectada. Se avisa para recargar.
  const orphanCheck = setInterval(() => {
    if (chrome.runtime?.id) return;
    clearInterval(orphanCheck);
    document.querySelector(".du-update")?.remove();
    const bar = document.createElement("div");
    bar.className = "du-update";
    bar.innerHTML = '<span>La extensión <b>DAT Driver Tabs</b> se actualizó. Recarga DAT para usar la versión nueva.</span>' +
      '<a href="#">Recargar (F5)</a>';
    bar.querySelector("a").onclick = (e) => { e.preventDefault(); location.reload(); };
    document.body.append(bar);
  }, 5000);
})();

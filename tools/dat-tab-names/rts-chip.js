// Chip con el rating de RTS al lado de cada broker en DAT One:
//  - en la lista de cargas, buscando el broker por nombre;
//  - en el detalle de la carga, por su MC (exacto).
(() => {
  const COLOR = { A: "#188038", B: "#1e8e3e", C: "#e37400", D: "#d93025", F: "#a50e0e" };
  const pending = new Map(); // clave → Promise

  const ask = (q) => {
    const k = q.mc ? `mc:${q.mc}` : `name:${q.name}`;
    if (!pending.has(k)) {
      pending.set(k, chrome.runtime.sendMessage({ type: "rts-lookup", ...q }).catch((e) => ({ error: String(e) })));
      // Se olvida al rato para que un error o un login nuevo se reintente
      setTimeout(() => pending.delete(k), 5 * 60 * 1000);
    }
    return pending.get(k);
  };

  function paint(chip, r) {
    chip.className = "du-rts";
    chip.style.background = "";
    if (r?.error === "login") {
      chip.textContent = "RTS: abre RTS";
      chip.classList.add("du-rts-muted");
      chip.title = "Abre rtspro.com con tu sesión en este Chrome para ver los ratings";
      chip.onclick = (e) => { e.stopPropagation(); window.open("https://rtspro.com/credit", "_blank"); };
      return;
    }
    chip.onclick = null;
    if (r?.error) { chip.textContent = "RTS: error"; chip.classList.add("du-rts-muted"); chip.title = r.error; return; }
    if (r?.none) { chip.textContent = "RTS: sin datos"; chip.classList.add("du-rts-muted"); chip.title = "RTS no tiene este broker"; return; }
    if (r?.ambiguous) {
      chip.textContent = "RTS: ?";
      chip.classList.add("du-rts-muted");
      chip.title = "Varios brokers con ese nombre — abre la carga para verlo por MC:\n" +
        r.ambiguous.map((d) => `${d.rating || "–"}  ${d.name} (MC ${d.mc})`).join("\n");
      return;
    }
    const d = r?.match;
    if (!d) { chip.remove(); return; }
    if (d.noBuy) {
      chip.textContent = "RTS: NO BUY";
      chip.style.background = "#a50e0e";
    } else {
      // Círculo con la letra (texto blanco) + días de pago al lado
      chip.textContent = "";
      chip.classList.add("du-rts-rated");
      const dot = document.createElement("span");
      dot.className = "du-rts-dot";
      dot.textContent = d.rating || "–";
      dot.style.background = COLOR[d.rating] || "#80868b";
      chip.append(dot);
      if (d.days) {
        const days = document.createElement("span");
        days.className = "du-rts-days";
        days.textContent = `${d.days}d`;
        chip.append(days);
      }
    }
    chip.title = [
      `${d.name} — MC ${d.mc}`,
      `Rating RTS: ${d.rating || "sin rating"}${d.previous && d.previous !== d.rating ? ` (antes ${d.previous})` : ""}`,
      d.days ? `Promedio de pago (60 días): ${d.days} días` : "",
      d.noBuy ? `NO BUY${d.noBuyDesc ? `: ${d.noBuyDesc}` : ""}` : "",
    ].filter(Boolean).join("\n");
  }

  function attach(anchor, q) {
    if (anchor.nextElementSibling?.classList?.contains("du-rts")) return;
    const chip = document.createElement("span");
    chip.className = "du-rts du-rts-muted";
    chip.textContent = "RTS…";
    anchor.after(chip);
    ask(q).then((r) => paint(chip, r));
  }

  function scan() {
    // Lista de cargas: nombre del broker
    for (const a of document.querySelectorAll('a[data-test="load-company-cell"]')) {
      const name = (a.textContent || "").trim();
      if (name) attach(a, { name });
    }
    // Detalle de la carga: "MC#322572"
    for (const el of document.querySelectorAll(".compliance-number")) {
      const m = (el.textContent || "").match(/MC#\s*(\d+)/);
      if (m) attach(el, { mc: m[1] });
    }
  }

  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
})();

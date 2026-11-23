// Chip con el rating de RTS al lado de cada broker en DAT One, buscado por el MC del broker:
//  - en la lista: el MC viene en los datos de cada carga (dat-capture.js), por su postingId;
//  - en el detalle: el "MC#" que muestra DAT.
// Solo si no hay MC se busca por nombre.
(() => {
  // A, B, C verde · D naranja · cualquier otra (E, F, N sin rating, I…) roja
  const COLOR = { A: "#188038", B: "#188038", C: "#188038", D: "#e37400" };
  const pending = new Map(); // clave → Promise

  const ask = (q) => {
    const k = q.mc ? `mc:${q.mc}` : `name:${q.name}|${q.phone || ""}`;
    if (!pending.has(k)) {
      let p;
      try { p = chrome.runtime.sendMessage({ type: "rts-lookup", ...q }).catch((e) => ({ error: String(e?.message || e) })); }
      catch (e) { p = Promise.resolve({ error: "La extensión se actualizó: recarga DAT (F5)" }); }
      pending.set(k, p);
      // Se olvida al rato para que un error o un login nuevo se reintente
      setTimeout(() => pending.delete(k), 5 * 60 * 1000);
    }
    return pending.get(k);
  };

  function paint(chip, r) {
    chip.className = chip.dataset.detail ? "du-rts du-rts-detail" : chip.dataset.before ? "du-rts du-rts-before" : "du-rts";
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
    if (r?.none) { chip.textContent = "RTS: sin datos"; chip.classList.add("du-rts-muted"); chip.title = /^mc:/.test(chip.dataset.key || "") ? `RTS no tiene este broker (MC ${chip.dataset.key.slice(3)})` : "Buscado por NOMBRE: DAT todavía no mandó el MC de esta carga (se corrige solo cuando llega, o al abrirla)"; return; }
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
      // NO BUY: triángulo negro con "!" blanco (el motivo va en el tooltip)
      chip.textContent = "";
      chip.classList.add("du-rts-rated");
      if (chip.dataset.detail) {
        const label = document.createElement("span");
        label.className = "du-rts-label";
        label.textContent = "RTS";
        chip.append(label);
      }
      const warn = document.createElement("span");
      warn.className = "du-rts-warn";
      warn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 1 21.5h22L12 2.5z" fill="#1f1f1f"/><path d="M11 9h2v6h-2zM11 17h2v2h-2z" fill="#fff"/></svg>';
      chip.append(warn);
    } else {
      // Círculo con la letra (texto blanco); los días de pago quedan en el tooltip
      chip.textContent = "";
      chip.classList.add("du-rts-rated");
      // En el detalle de la carga: "RTS" + círculo más grande
      if (chip.dataset.detail) {
        const label = document.createElement("span");
        label.className = "du-rts-label";
        label.textContent = "RTS";
        chip.append(label);
      }
      const dot = document.createElement("span");
      dot.className = "du-rts-dot";
      dot.textContent = d.rating || "–";
      dot.style.background = COLOR[d.rating] || "#d93025";
      chip.append(dot);
    }
    chip.title = [
      `${d.name} — MC ${d.mc}`,
      `Rating RTS: ${d.rating || "sin rating"}${d.previous && d.previous !== d.rating ? ` (antes ${d.previous})` : ""}`,
      d.days ? `Promedio de pago (60 días): ${d.days} días` : "",
      d.noBuy ? `NO BUY${d.noBuyDesc ? `: ${d.noBuyDesc}` : ""}` : "",
    ].filter(Boolean).join("\n");
  }

  // MC/DOT de cada carga, por postingId (los manda dat-capture.js desde la página)
  const postings = new Map();
  window.addEventListener("message", (e) => {
    if (e.source !== window || !Array.isArray(e.data?.__duDatPostings)) return;
    for (const p of e.data.__duDatPostings) if (p.postingId) postings.set(p.postingId, p);
    schedule();
  });

  window.postMessage({ __duDatRequest: true }, location.origin);

  const keyOf = (q) => (q.mc ? `mc:${q.mc}` : `name:${q.name}|${q.phone || ""}`);

  // inside=true: el chip va dentro del elemento (pegado al texto), no como hermano.
  // Si el chip ya existe pero ahora hay una búsqueda mejor (MC en vez de nombre), se rehace.
  // where: "inside" (dentro del elemento) o "before" (a la izquierda del elemento, en la lista)
  function attach(anchor, q, where = "before") {
    const inside = where === "inside" || where === true;
    let chip = inside
      ? anchor.querySelector(":scope > .du-rts")
      : anchor.previousElementSibling?.classList?.contains("du-rts") ? anchor.previousElementSibling : null;
    const key = keyOf(q);
    if (chip && chip.dataset.key === key) return chip;
    if (!chip) {
      chip = document.createElement("span");
      if (inside) anchor.append(chip); else anchor.before(chip);
    }
    chip.dataset.key = key;
    if (!inside) chip.dataset.before = "1";
    chip.className = "du-rts du-rts-muted" + (chip.dataset.before ? " du-rts-before" : "");
    chip.style.background = "";
    chip.textContent = "RTS…";
    ask(q).then((r) => { if (chip.dataset.key === key) paint(chip, r); });
    return chip;
  }

  // Teléfono del broker en la fila de la carga (solo para la búsqueda por nombre)
  const rowPhone = (row) => {
    const el = row?.querySelector('[href-value^="tel:"], a[href^="tel:"]');
    return (el?.getAttribute("href-value") || el?.getAttribute("href") || "").replace(/\D/g, "").slice(-10);
  };
  // Texto del elemento sin nuestro chip
  const ownText = (el) => [...el.childNodes].filter((n) => !n.classList?.contains("du-rts")).map((n) => n.textContent || "").join("");

  function scan() {
    // Lista de cargas
    for (const a of document.querySelectorAll('a[data-test="load-company-cell"]')) {
      const name = (a.textContent || "").trim();
      if (!name) continue;
      const row = a.closest("dat-result-row");
      const pid = row?.querySelector("[posting-id]")?.getAttribute("posting-id");
      const info = pid ? postings.get(pid) : null;
      attach(a, info?.mc ? { mc: info.mc } : { name, phone: rowPhone(row) });
    }
    // Detalle de la carga: el MC# que muestra DAT; el chip va a la derecha del nombre del broker
    for (const el of document.querySelectorAll(".compliance-number")) {
      const m = ownText(el).match(/MC#\s*(\d+)/);
      if (!m) continue;
      const nameBox = el.closest("dat-company")?.querySelector(".company-name");
      if (!nameBox) { attach(el, { mc: m[1] }, true); continue; }
      el.querySelector(":scope > .du-rts")?.remove();
      const chip = nameBox.querySelector(":scope > .du-rts");
      if (chip && chip.dataset.key === `mc:${m[1]}`) continue;
      if (chip) chip.remove();
      const span = document.createElement("span");
      span.dataset.detail = "1";
      nameBox.append(span);
      // attach() reutiliza este span (mismo lugar) y lo pinta
      span.className = "du-rts";
      attach(nameBox, { mc: m[1] }, true);
    }
  }

  let t = null;
  const schedule = () => { clearTimeout(t); t = setTimeout(scan, 300); };

  // Sesión de RTS nueva (abriste rtspro.com): reintentar al momento los chips con "abre RTS" o error
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch.rtsAuth?.newValue) return;
    pending.clear();
    for (const chip of document.querySelectorAll(".du-rts.du-rts-muted")) delete chip.dataset.key;
    schedule();
  });
  // DAT reutiliza las filas: a veces solo cambia el texto o el posting-id de una fila (carga nueva
  // en la misma fila) sin agregar elementos. Por eso se vigilan también texto y posting-id, y se
  // revisa cada pocos segundos por si acaso.
  // Si la extensión se recarga/actualiza con DAT abierto, este script queda huérfano (sin acceso
  // a la extensión): se apaga solo en vez de llenar "Errores" de chrome://extensions.
  const obs = new MutationObserver(() => alive() && schedule());
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["posting-id", "href-value", "recipient-email"] });
  const iv = setInterval(() => { if (alive() && !document.hidden) scan(); }, 4000);
  function alive() { if (chrome.runtime?.id) return true; obs.disconnect(); clearInterval(iv); clearTimeout(t); return false; }
  scan();
})();

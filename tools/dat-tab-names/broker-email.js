// Botón "✉ Email" en el detalle de la carga de DAT. La configuración se abre con el botón
// "Configurar email" (a la derecha de los filtros de búsqueda) o con el ícono de la extensión. Según el modo:
//  - Enviar directo: se envía desde 58logisticsllc@gmail.com (función dat-broker-email de
//    Dispatch Up) al instante; el botón se anima mientras envía. Queda marcado "Enviado ✓".
//  - Abrir en Gmail: abre Gmail con el correo listo para revisar y enviar a mano.
(() => {
  const postings = new Map();
  const sentAt = new Map(); // postingId → fecha del último envío
  window.addEventListener("message", (e) => {
    if (e.source !== window || !Array.isArray(e.data?.__duDatPostings)) return;
    for (const p of e.data.__duDatPostings) if (p.postingId) postings.set(p.postingId, p);
  });
  window.postMessage({ __duDatRequest: true }, location.origin);

  const fmtDate = (d) => {
    const m = String(d || "").match(/^\d{4}-(\d{2})-(\d{2})/);
    return m ? `${m[1]}/${m[2]}` : d || "";
  };

  // Nombre del driver que tiene la pestaña de búsqueda activa (etiqueta de content.js)
  const activeDriver = () => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"], [role="tab"].mat-tab-label-active');
    return (tab?.querySelector(".du-chip:not(.du-empty)")?.textContent || "").trim();
  };

  function toast(html, ms = 3500) {
    document.querySelector(".du-toast")?.remove();
    const d = document.createElement("div");
    d.className = "du-toast";
    d.innerHTML = html;
    document.body.append(d);
    if (ms) setTimeout(() => d.remove(), ms);
    return d;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Datos que se ven en la fila de la carga en la lista. Respaldo cuando DAT no mandó los datos
  // completos de esa carga (antes salían emails con "From  To" vacío).
  function rowData(pid) {
    const row = pid ? document.querySelector(`dat-result-row [posting-id="${CSS.escape(pid)}"]`)?.closest("dat-result-row") : null;
    if (!row) return {};
    const cell = (t) => (row.querySelector(`[data-test="${t}"]`)?.textContent || "").replace(/\s+/g, " ").trim();
    const digits = (x) => (String(x).match(/[\d,]+/)?.[0] || "").replace(/,/g, "");
    const destination = cell("load-destination-cell");
    let origin = cell("load-origin-cell");
    // En pantallas angostas DAT pone origen y destino juntos en la misma celda
    if (destination && origin.endsWith(destination) && origin !== destination) origin = origin.slice(0, -destination.length).trim();
    return {
      name: cell("load-company-cell"),
      origin,
      destination,
      dho: digits(cell("load-dho-cell")),
      date: cell("load-pick-up-cell").split(" - ")[0],
      miles: digits(cell("load-trip-cell")),
      equipment: cell("load-eq-cell"),
      weight: digits(cell("load-weight-cell")),
      length: digits(cell("load-length-cell")),
      rate: digits(cell("load-rate-cell").match(/\$[\d,]+/)?.[0] || ""),
    };
  }

  async function build(info, fallbackEmail, pid) {
    const { emailCfg } = await chrome.storage.sync.get("emailCfg");
    const cfg = { ...DU_EMAIL_DEFAULTS, mode: "direct", ...(emailCfg || {}) };
    const d = rowData(pid);
    const pick = (a, b) => (a !== undefined && a !== null && a !== "" ? a : b || "");
    const weight = pick(info?.weight, d.weight), rate = pick(info?.rate, d.rate);
    const vals = {
      broker: pick(info?.name, d.name),
      origen: pick(info?.origin, d.origin),
      destino: pick(info?.destination, d.destination),
      dho: pick(info?.dho, d.dho),
      fecha: info?.date ? fmtDate(info.date) : d.date || "",
      millas: pick(info?.miles, d.miles),
      equipo: pick(info?.equipment, d.equipment),
      peso: weight ? Number(weight).toLocaleString("en-US") : "",
      largo: pick(info?.length, d.length),
      rate: rate ? `$${Number(rate).toLocaleString("en-US")}` : "",
      referencia: info?.ref || "",
      driver: activeDriver(),
    };
    return {
      cfg,
      vals,
      to: (info?.email || fallbackEmail || "").trim(),
      subject: duFillTemplate(cfg.subject, vals),
      body: duFillTemplate(cfg.body, vals),
    };
  }

  function openGmail(cfg, to, subject, body) {
    const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
    if (cfg.from) params.set("authuser", cfg.from);
    window.open(`https://mail.google.com/mail/?${params}`, "_blank", "noopener");
  }

  const LABEL = { email: '<span aria-hidden="true">✉</span> Email', sent: '<span aria-hidden="true">✓</span> Enviado' };
  function markSent(btn, when) {
    btn.classList.add("du-mail-sent");
    btn.innerHTML = btn.dataset.row ? "✓" : LABEL.sent;
    btn.title = `Email enviado ${new Date(when).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}. Pulsa para reenviar.`;
  }

  // Si la extensión se recargó/actualizó, esta página queda desconectada de ella: avisar en vez
  // de no hacer nada (antes el clic fallaba en silencio).
  const STALE = "La extensión se actualizó. Recarga DAT (F5) y vuelve a pulsar ✉.";
  const isStale = (e) => !chrome.runtime?.id || /context invalidated|Receiving end does not exist/i.test(String(e?.message || e));
  async function onClick(btn, comp, fallbackEmail = "") {
    if (!chrome.runtime?.id) { toast(STALE, 6000); return; }
    try { await send(btn, comp, fallbackEmail); }
    catch (e) {
      delete btn.dataset.sending;
      btn.classList.remove("du-mail-sending");
      if (btn.querySelector(".du-mail-spin")) btn.innerHTML = btn.dataset.row ? "✉" : LABEL.email;
      toast(isStale(e) ? STALE : `No se envió: ${esc(e?.message || e)}`, 6000);
    }
  }

  async function send(btn, comp, fallbackEmail) {
    const pid = btn.dataset.pid || comp.querySelector("[posting-id]")?.getAttribute("posting-id");
    const info = pid ? postings.get(pid) : null;
    const shown = fallbackEmail || (comp.textContent || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
    const { cfg, vals, to, subject, body } = await build(info, shown, pid);
    if (!to) { toast("Esta carga no tiene email del broker."); return; }
    // Nunca mandar un email con la ruta vacía
    if (!vals.origen || !vals.destino) {
      toast("No tengo el origen/destino de esta carga. Recarga DAT (F5) o vuelve a buscar, y envía de nuevo.", 6000);
      return;
    }

    if (cfg.mode === "gmail") { openGmail(cfg, to, subject, body); return; }

    // Ya se le escribió por esta carga: pedir un segundo clic para reenviar
    if (pid && sentAt.has(pid) && btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      setTimeout(() => delete btn.dataset.confirm, 4000);
      toast(`Ya le escribiste por esta carga. Pulsa <b>${btn.dataset.row ? "✓" : "Enviado"}</b> otra vez para reenviar.`, 4000);
      return;
    }
    delete btn.dataset.confirm;
    if (btn.dataset.sending) return;
    btn.dataset.sending = "1";

    // Animación en el botón mientras se envía
    const prevHtml = btn.innerHTML;
    btn.classList.remove("du-mail-sent", "du-mail-fail");
    btn.classList.add("du-mail-sending");
    btn.innerHTML = btn.dataset.row ? '<span class="du-mail-spin" aria-hidden="true"></span>' : '<span class="du-mail-spin" aria-hidden="true"></span> Enviando…';
    const r = await chrome.runtime.sendMessage({
      type: "broker-email-send",
      payload: {
        action: "send", to, subject, body, posting_id: pid || null,
        broker: info?.name || "", broker_mc: info?.mc || "", origin: info?.origin || "", destination: info?.destination || "",
      },
    }).catch((e) => ({ error: String(e?.message || e) }));
    delete btn.dataset.sending;
    btn.classList.remove("du-mail-sending");
    if (r?.ok) {
      const now = new Date().toISOString();
      if (pid) sentAt.set(pid, now);
      markSent(btn, now);
      // El mismo envío se marca en la fila y en el detalle de esa carga
      if (pid) for (const b of document.querySelectorAll(`.du-mail[data-pid="${CSS.escape(pid)}"]`)) if (b !== btn) markSent(b, now);
      btn.classList.add("du-mail-pop");
      setTimeout(() => btn.classList.remove("du-mail-pop"), 600);
      toast(`✓ Email enviado a <b>${esc(to)}</b>`);
    } else {
      btn.innerHTML = prevHtml;
      btn.classList.add("du-mail-fail");
      setTimeout(() => btn.classList.remove("du-mail-fail"), 600);
      toast(isStale(r?.error) ? STALE : `No se envió: ${esc(r?.error || "error desconocido")}`, 6000);
    }
  }

  // Cargas ya escritas (para mostrar "Enviado ✓"). Se consulta en lote: una sola llamada por
  // tanda de filas nuevas, no una por carga.
  const sentQueue = new Map(); // pid → [botones]
  let sentTimer = null;
  function refreshSent(pid, btn) {
    if (!pid) return;
    if (sentAt.has(pid)) { markSent(btn, sentAt.get(pid)); return; }
    if (!sentQueue.has(pid)) sentQueue.set(pid, []);
    sentQueue.get(pid).push(btn);
    clearTimeout(sentTimer);
    sentTimer = setTimeout(async () => {
      const batch = new Map(sentQueue);
      sentQueue.clear();
      let r = null;
      try { r = await chrome.runtime.sendMessage({ type: "broker-email-send", payload: { action: "sent", posting_ids: [...batch.keys()] } }); } catch {}
      for (const [id, btns] of batch) {
        if (r?.sent?.[id]) sentAt.set(id, r.sent[id]);
        if (sentAt.has(id)) for (const b of btns) if (b.isConnected && b.dataset.pid === id) markSent(b, sentAt.get(id));
      }
    }, 400);
  }

  function makeBtn(pid, row) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = row ? "du-mail du-mail-row" : "du-mail";
    if (row) btn.dataset.row = "1";
    if (pid) btn.dataset.pid = pid;
    btn.innerHTML = row ? "✉" : LABEL.email;
    btn.title = "Enviar el email de tu plantilla al broker (configúralo con «Configurar email», arriba a la derecha)";
    return btn;
  }

  // El botón va a la derecha del email del broker (Contact Information). Si DAT aún no muestra
  // el email (o la carga no tiene), queda junto al nombre del broker y se mueve cuando aparezca.
  function scan() {
    // Un solo botón "Configurar email" por búsqueda, a la derecha de la fila de filtros
    for (const bar of document.querySelectorAll(".search-filters")) {
      if (bar.querySelector(":scope > .du-cfg")) continue;
      const cfg = document.createElement("button");
      cfg.type = "button";
      cfg.className = "du-cfg";
      cfg.innerHTML = '<span aria-hidden="true">✉</span> Configurar email';
      cfg.title = "Plantilla del email a brokers, modo de envío y clave";
      cfg.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        try { chrome.runtime.sendMessage({ type: "open-options" }); } catch { toast(STALE, 6000); }
      });
      bar.append(cfg);
    }
    for (const comp of document.querySelectorAll("dat-company")) {
      const nameBox = comp.querySelector(".company-name");
      if (!nameBox || !comp.querySelector(".compliance-number")) continue;
      const scope = comp.closest("dat-load-details") || comp;
      const target = scope.querySelector(".contacts__email") || nameBox;
      let btn = scope.querySelector(".du-mail:not(.du-mail-row)");
      if (!btn) {
        const pid = scope.querySelector("[posting-id]")?.getAttribute("posting-id");
        btn = makeBtn(pid, false);
        btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(btn, scope); });
        refreshSent(pid, btn);
      }
      if (btn.parentElement !== target) target.append(btn);
    }
    // Lista de cargas: ✉ pequeño al lado del contacto, solo si la carga tiene email del broker
    for (const link of document.querySelectorAll('dat-result-row connected-email-contact-link[data-test="load-contact-cell"]')) {
      const box = link.parentElement;
      const pid = link.getAttribute("posting-id") || "";
      const email = (postings.get(pid)?.email || link.getAttribute("recipient-email") ||
        (link.getAttribute("href-value") || "").replace(/^mailto:/, "")).trim();
      const has = /@/.test(email);
      let btn = box.querySelector(":scope > .du-mail-row");
      // La lista recicla filas al hacer scroll: si la fila ahora es otra carga, se rehace
      if (btn && (btn.dataset.pid !== pid || !has)) { btn.remove(); btn = null; }
      if (btn || !has) continue;
      btn = makeBtn(pid, true);
      btn.title = `Enviar el email de tu plantilla a ${email}`;
      const row = link.closest("dat-result-row");
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(btn, row, email); });
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      link.after(btn);
      refreshSent(pid, btn);
    }
  }

  let t = null;
  // Igual que en rts-chip.js: DAT reutiliza filas (cambia texto/posting-id sin agregar elementos)
  // Si la extensión se recarga/actualiza con DAT abierto, este script queda huérfano (sin acceso
  // a la extensión): deja de vigilar la página (los botones avisan que hay que recargar) en vez de llenar "Errores" de chrome://extensions.
  const obs = new MutationObserver(() => { if (alive()) { clearTimeout(t); t = setTimeout(scan, 300); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["posting-id", "href-value", "recipient-email"] });
  const iv = setInterval(() => { if (alive() && !document.hidden) scan(); }, 4000);
  function alive() { if (chrome.runtime?.id) return true; obs.disconnect(); clearInterval(iv); clearTimeout(t); return false; }
  scan();
})();

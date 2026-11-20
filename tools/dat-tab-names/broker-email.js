// Botón "✉ Email" en el detalle de la carga de DAT. Según la configuración (⚙):
//  - Enviar directo: se envía desde 58logisticsllc@gmail.com (función dat-broker-email de
//    Dispatch Up), con 5 segundos para "Deshacer". Queda marcado "Enviado ✓" en esa carga.
//  - Abrir en Gmail: abre Gmail con el correo listo para revisar y enviar a mano.
(() => {
  const UNDO_SECONDS = 5;
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

  async function build(info, fallbackEmail) {
    const { emailCfg } = await chrome.storage.sync.get("emailCfg");
    const cfg = { ...DU_EMAIL_DEFAULTS, mode: "direct", ...(emailCfg || {}) };
    const vals = {
      broker: info?.name || "",
      origen: info?.origin || "",
      destino: info?.destination || "",
      dho: info?.dho ?? "",
      fecha: fmtDate(info?.date),
      millas: info?.miles ?? "",
      equipo: info?.equipment || "",
      peso: info?.weight ? Number(info.weight).toLocaleString("en-US") : "",
      largo: info?.length ?? "",
      rate: info?.rate ? `$${Number(info.rate).toLocaleString("en-US")}` : "",
      referencia: info?.ref || "",
      driver: activeDriver(),
    };
    return {
      cfg,
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

  function markSent(btn, when) {
    btn.classList.add("du-mail-sent");
    btn.innerHTML = '<span aria-hidden="true">✓</span> Enviado';
    btn.title = `Email enviado ${new Date(when).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}. Pulsa para reenviar.`;
  }

  async function onClick(btn, comp) {
    const pid = comp.querySelector("[posting-id]")?.getAttribute("posting-id");
    const info = pid ? postings.get(pid) : null;
    const shown = (comp.textContent || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
    const { cfg, to, subject, body } = await build(info, shown);
    if (!to) { toast("Esta carga no tiene email del broker."); return; }

    if (cfg.mode === "gmail") { openGmail(cfg, to, subject, body); return; }

    // Ya se le escribió por esta carga: pedir un segundo clic para reenviar
    if (pid && sentAt.has(pid) && btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      setTimeout(() => delete btn.dataset.confirm, 4000);
      toast(`Ya le escribiste por esta carga. Pulsa <b>Enviado</b> otra vez para reenviar.`, 4000);
      return;
    }
    delete btn.dataset.confirm;
    if (btn.dataset.sending) return;
    btn.dataset.sending = "1";

    // Envío con "Deshacer"
    let left = UNDO_SECONDS, cancelled = false;
    const t = toast("", 0);
    const render = () => {
      t.innerHTML = `Enviando a <b>${esc(to)}</b> en ${left}s… <button type="button" class="du-undo">Deshacer</button>`;
      t.querySelector(".du-undo").onclick = () => { cancelled = true; };
    };
    render();
    await new Promise((done) => {
      const iv = setInterval(() => {
        if (cancelled) { clearInterval(iv); done(); return; }
        left -= 1;
        if (left <= 0) { clearInterval(iv); done(); } else render();
      }, 1000);
    });
    if (cancelled) { t.remove(); toast("Envío cancelado."); delete btn.dataset.sending; return; }

    t.innerHTML = `Enviando a <b>${esc(to)}</b>…`;
    const r = await chrome.runtime.sendMessage({
      type: "broker-email-send",
      payload: {
        action: "send", to, subject, body, posting_id: pid || null,
        broker: info?.name || "", broker_mc: info?.mc || "", origin: info?.origin || "", destination: info?.destination || "",
      },
    }).catch((e) => ({ error: String(e?.message || e) }));
    delete btn.dataset.sending;
    t.remove();
    if (r?.ok) {
      const now = new Date().toISOString();
      if (pid) sentAt.set(pid, now);
      markSent(btn, now);
      toast(`✓ Email enviado a <b>${esc(to)}</b>`);
    } else {
      toast(`No se envió: ${esc(r?.error || "error desconocido")}`, 6000);
    }
  }

  // Cargas ya escritas (para mostrar "Enviado ✓" al abrir el detalle)
  async function refreshSent(pid, btn) {
    if (!pid) return;
    if (!sentAt.has(pid)) {
      const r = await chrome.runtime.sendMessage({ type: "broker-email-send", payload: { action: "sent", posting_ids: [pid] } }).catch(() => null);
      if (r?.sent?.[pid]) sentAt.set(pid, r.sent[pid]);
    }
    if (sentAt.has(pid)) markSent(btn, sentAt.get(pid));
  }

  function scan() {
    for (const comp of document.querySelectorAll("dat-company")) {
      const nameBox = comp.querySelector(".company-name");
      if (!nameBox || !comp.querySelector(".compliance-number") || nameBox.querySelector(":scope > .du-mail")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "du-mail";
      btn.innerHTML = '<span aria-hidden="true">✉</span> Email';
      btn.title = "Enviar el email de tu plantilla al broker";
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(btn, comp); });
      const gear = document.createElement("button");
      gear.type = "button";
      gear.className = "du-mail du-mail-gear";
      gear.textContent = "⚙";
      gear.title = "Configurar el email (plantilla, modo de envío y clave)";
      gear.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); chrome.runtime.sendMessage({ type: "open-options" }); });
      nameBox.append(btn, gear);
      refreshSent(comp.querySelector("[posting-id]")?.getAttribute("posting-id"), btn);
    }
  }

  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
})();

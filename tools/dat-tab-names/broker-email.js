// Botón "✉ Email" en el detalle de la carga de DAT: abre Gmail (desde la cuenta configurada)
// con el correo al broker ya escrito según la plantilla. El usuario lo revisa y lo envía.
(() => {
  const postings = new Map();
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

  async function compose(info, fallbackEmail) {
    const { emailCfg } = await chrome.storage.sync.get("emailCfg");
    const cfg = { ...DU_EMAIL_DEFAULTS, ...(emailCfg || {}) };
    const to = info?.email || fallbackEmail;
    if (!to) { alertBox("Esta carga no tiene email del broker."); return; }
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
    const params = new URLSearchParams({
      view: "cm", fs: "1", to,
      su: duFillTemplate(cfg.subject, vals),
      body: duFillTemplate(cfg.body, vals),
    });
    if (cfg.from) params.set("authuser", cfg.from);
    window.open(`https://mail.google.com/mail/?${params}`, "_blank", "noopener");
  }

  function alertBox(msg) {
    const d = document.createElement("div");
    d.className = "du-toast";
    d.textContent = msg;
    document.body.append(d);
    setTimeout(() => d.remove(), 3500);
  }

  function scan() {
    for (const comp of document.querySelectorAll("dat-company")) {
      const nameBox = comp.querySelector(".company-name");
      if (!nameBox || !comp.querySelector(".compliance-number") || nameBox.querySelector(":scope > .du-mail")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "du-mail";
      btn.innerHTML = '<span aria-hidden="true">✉</span> Email';
      btn.title = "Escribir al broker en Gmail con tu plantilla";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = comp.querySelector("[posting-id]")?.getAttribute("posting-id");
        const info = pid ? postings.get(pid) : null;
        // Si DAT no mandó el email en los datos, se toma el que muestra el detalle
        const shown = (comp.textContent || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
        compose(info, shown);
      });
      const gear = document.createElement("button");
      gear.type = "button";
      gear.className = "du-mail du-mail-gear";
      gear.textContent = "⚙";
      gear.title = "Configurar cuenta y plantilla del email";
      gear.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: "open-options" });
      });
      nameBox.append(btn, gear);
    }
  }

  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
})();

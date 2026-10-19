// Asistente de factoring RTS (Dispatch Up): en Factoring → Invoices del portal de RTS agrega el botón
// "Llenar desde Dispatch Up". Trae del TMS las cargas entregadas en Factoring "Pending" y, por cada
// una que elijas, crea la factura: Invoice # y PO # = número de carga, Customer = broker, Amount = rate,
// y adjunta el RC y el POD de cada entrega. Nunca envía: "Submit purchase" lo pulsas tú.
(() => {
  const API = "https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/rts-assistant";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const filled = new Map(); // número de carga -> id de la carga en el TMS (para marcar Ready)

  const getKey = () => new Promise((r) => chrome.storage.local.get("key", (d) => r(d.key || "")));
  const setKey = (key) => new Promise((r) => chrome.storage.local.set({ key }, r));

  async function api(body) {
    const key = await getKey();
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "x-assistant-key": key }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
    return data;
  }

  // ─── Escribir en los campos de RTS (React) ───
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  function typeInto(input, value) {
    input.focus();
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|inc|corp|co|ltd|logistics|the)\b/g, " ").replace(/\s+/g, " ").trim();

  async function pickDebtor(card, broker) {
    const input = card.querySelector("#debtor input");
    if (!input) return false;
    // Se escribe el inicio del nombre: RTS busca en su lista de brokers y muestra sugerencias
    const query = broker.replace(/[,.]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
    typeInto(input, query);
    let options = [];
    for (let i = 0; i < 16 && !options.length; i++) {
      await sleep(250);
      options = [...card.querySelectorAll('#debtor [role="option"], #debtor li')];
    }
    if (!options.length) return false;
    const target = norm(broker);
    const best = options.find((o) => norm(o.textContent) === target)
      || options.find((o) => norm(o.textContent).startsWith(target) || target.startsWith(norm(o.textContent)))
      || (options.length === 1 ? options[0] : null);
    if (!best) return false;
    for (const type of ["mousedown", "mouseup", "click"]) best.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    await sleep(300);
    return true;
  }

  async function attachFiles(card, docs) {
    const input = card.querySelector(':scope > input[type="file"]') || card.querySelector('input[type="file"]');
    if (!input || !docs.length) return 0;
    const dt = new DataTransfer();
    for (const d of docs) {
      const res = await fetch(d.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : (/\.pdf$/i.test(d.name) ? "application/pdf" : "image/jpeg");
      dt.items.add(new File([blob], d.name.replace(/[\\/:*?"<>|#]/g, " ").replace(/\s+/g, " ").trim(), { type }));
    }
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return dt.files.length;
  }

  const cards = () => [...document.querySelectorAll('[class*="InvoicesCard__invoiceDropzone"]')].filter((c) => c.querySelector("#invoiceNumber"));

  async function createInvoice(load) {
    const before = cards().length;
    const createBtn = [...document.querySelectorAll("button")].find((b) => /create an invoice/i.test(b.textContent || ""));
    if (!createBtn) throw new Error('No encontré el botón "Create an Invoice"');
    createBtn.click();
    let card = null;
    for (let i = 0; i < 20 && !card; i++) { await sleep(200); if (cards().length > before) card = cards()[cards().length - 1]; }
    if (!card) throw new Error("RTS no abrió la fila de la factura");

    typeInto(card.querySelector("#invoiceNumber input"), load.reference);
    typeInto(card.querySelector("#poNumber input"), load.reference);
    typeInto(card.querySelector("#amount input"), load.amount.toFixed(2));
    const debtorOk = await pickDebtor(card, load.broker);
    const files = await attachFiles(card, load.docs);
    const problems = [];
    if (!debtorOk) problems.push(`elige el broker "${load.broker}"`);
    if (!load.has_rc) problems.push("sin RC");
    if (!load.pods) problems.push("sin POD");
    if (problems.length) card.classList.add("du-rts-flag");
    filled.set(load.reference, load.id);
    return { files, problems };
  }

  // ─── Ventana con las cargas ───
  function modal(html) {
    document.querySelector(".du-rts-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "du-rts-overlay";
    overlay.innerHTML = `<div class="du-rts-modal">${html}</div>`;
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function askKey(message) {
    const o = modal(`
      <h3>Conectar con Dispatch Up</h3>
      <p class="du-sub">${esc(message || "Pega la clave del asistente: en el TMS, Companies → Asistente RTS.")}</p>
      <input type="text" placeholder="Clave del asistente">
      <div class="du-rts-actions"><button class="du-rts-btn du-cancel">Cancelar</button><button class="du-rts-btn du-primary du-save">Guardar</button></div>`);
    o.querySelector(".du-cancel").onclick = () => o.remove();
    o.querySelector(".du-save").onclick = async () => {
      const v = o.querySelector("input").value.trim();
      if (!v) return;
      await setKey(v);
      o.remove();
      openPicker();
    };
    o.querySelector("input").focus();
  }

  async function openPicker() {
    if (!(await getKey())) return askKey();
    const o = modal(`<h3>Cargas para facturar</h3><p class="du-sub">Cargando…</p>`);
    let data;
    try { data = await api({ action: "list" }); }
    catch (e) { o.remove(); return askKey(e.status === 401 ? e.message : `No se pudo conectar: ${e.message}`); }
    const loads = (data.loads || []).filter((l) => !filled.has(l.reference));
    if (!loads.length) {
      o.querySelector(".du-rts-modal").innerHTML = `<h3>Cargas para facturar</h3><p class="du-sub">No hay cargas entregadas en Factoring "Pending" de 58 Logistics.</p>
        <div class="du-rts-actions"><button class="du-rts-btn du-close">Cerrar</button></div>`;
      o.querySelector(".du-close").onclick = () => o.remove();
      return;
    }
    const rows = loads.map((l, i) => {
      const warn = [!l.has_rc && "sin RC", !l.pods && `sin POD${l.deliveries > 1 ? ` (${l.deliveries} entregas)` : ""}`,
        l.pods && l.pods < l.deliveries && `POD de ${l.pods} de ${l.deliveries} entregas`].filter(Boolean);
      return `<tr>
        <td><input type="checkbox" data-i="${i}" ${warn.length ? "" : "checked"}></td>
        <td><b>${esc(l.reference)}</b><br><span style="color:#6b7280">${esc(l.delivery_date || "")}</span></td>
        <td>${esc(l.broker)}</td>
        <td>$${l.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td>${warn.length ? `<span class="du-rts-warn">⚠ ${esc(warn.join(" · "))}</span>` : `<span class="du-rts-ok">RC + ${l.pods} POD</span>`}</td>
      </tr>`;
    }).join("");
    o.querySelector(".du-rts-modal").innerHTML = `
      <h3>Cargas para facturar</h3>
      <p class="du-sub">Entregadas en Factoring "Pending" (58 Logistics). Se crea una factura por carga con su RC y el POD de cada entrega.</p>
      <table><thead><tr><th></th><th>Carga</th><th>Broker</th><th>Monto</th><th>Documentos</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="du-rts-actions">
        <span class="du-grow du-status"></span>
        <button class="du-rts-btn du-key">Cambiar clave</button>
        <button class="du-rts-btn du-cancel">Cancelar</button>
        <button class="du-rts-btn du-primary du-go">Llenar facturas</button>
      </div>`;
    o.querySelector(".du-cancel").onclick = () => o.remove();
    o.querySelector(".du-key").onclick = () => { o.remove(); askKey(); };
    o.querySelector(".du-go").onclick = async () => {
      const chosen = [...o.querySelectorAll("input[type=checkbox]:checked")].map((c) => loads[Number(c.dataset.i)]);
      if (!chosen.length) return;
      const status = o.querySelector(".du-status");
      o.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const report = [];
      for (const [n, load] of chosen.entries()) {
        status.textContent = `Llenando ${n + 1} de ${chosen.length}: ${load.reference}…`;
        try {
          const r = await createInvoice(load);
          report.push(r.problems.length ? `⚠ ${load.reference}: ${r.problems.join(", ")}` : `✓ ${load.reference} (${r.files} archivos)`);
        } catch (e) {
          report.push(`✗ ${load.reference}: ${e.message}`);
        }
      }
      o.querySelector(".du-rts-modal").innerHTML = `
        <h3>Listo para revisar</h3>
        <p class="du-sub">Revisa cada factura en RTS (las marcadas en naranja necesitan algo) y pulsa <b>Submit purchase</b> cuando esté bien.</p>
        <div style="white-space:pre-line;font-size:13px">${esc(report.join("\n"))}</div>
        <div class="du-rts-actions"><button class="du-rts-btn du-primary du-close">Entendido</button></div>`;
      o.querySelector(".du-close").onclick = () => o.remove();
    };
  }

  // ─── Después de "Submit purchase": marcar Ready en el TMS ───
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button");
    if (!btn || !/submit purchase/i.test(btn.textContent || "") || !filled.size) return;
    const refs = cards().map((c) => c.querySelector("#invoiceNumber input")?.value?.trim()).filter((r) => filled.has(r));
    if (!refs.length) return;
    setTimeout(() => showMarkBanner(refs), 1500);
  }, true);

  function showMarkBanner(refs) {
    document.querySelector(".du-rts-banner")?.remove();
    const b = document.createElement("div");
    b.className = "du-rts-banner";
    b.innerHTML = `<span>¿RTS recibió las facturas? Marcar <b>${refs.length}</b> carga(s) como <b>Ready</b> en Dispatch Up (genera los pagos).</span>
      <button class="du-rts-btn du-primary du-yes">Marcar Ready</button><button class="du-rts-btn du-no">Ahora no</button>`;
    b.querySelector(".du-no").onclick = () => b.remove();
    b.querySelector(".du-yes").onclick = async () => {
      b.querySelectorAll("button").forEach((x) => (x.disabled = true));
      try {
        const r = await api({ action: "mark_ready", load_ids: refs.map((r) => filled.get(r)) });
        refs.forEach((r) => filled.delete(r));
        b.innerHTML = `<span>✓ Marcadas Ready: ${esc((r.marked || []).join(", ") || "ninguna")}</span>`;
        setTimeout(() => b.remove(), 6000);
      } catch (e) {
        b.innerHTML = `<span>No se pudo marcar: ${esc(e.message)}</span>`;
        setTimeout(() => b.remove(), 8000);
      }
    };
    document.body.appendChild(b);
  }

  // ─── Botón flotante solo en Factoring → Invoices (la página cambia sin recargar) ───
  function syncFab() {
    const onInvoices = location.pathname.startsWith("/factoring/invoices");
    let fab = document.querySelector(".du-rts-fab");
    if (onInvoices && !fab) {
      fab = document.createElement("button");
      fab.className = "du-rts-fab";
      fab.textContent = "Llenar desde Dispatch Up";
      fab.onclick = openPicker;
      document.body.appendChild(fab);
    } else if (!onInvoices && fab) fab.remove();
  }
  syncFab();
  setInterval(syncFab, 1000);
})();

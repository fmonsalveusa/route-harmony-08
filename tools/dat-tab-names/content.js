// Nombre del driver en cada pestaña de búsqueda de DAT One.
// Solo agrega una etiqueta en la pantalla: no toca la cuenta ni las búsquedas de DAT.
// La etiqueta se guarda por búsqueda (origen + destino) en el almacenamiento de la extensión;
// si se cambia el origen de una pestaña, la etiqueta la sigue por su posición.
(() => {
  const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];
  let labels = {}; // key -> { name, color, index }

  const keyOf = (tab) => {
    // Texto de la búsqueda sin nuestra etiqueta
    const lines = [...tab.querySelectorAll(".load-details > div")].map((d) =>
      [...d.childNodes].filter((n) => !n.classList?.contains("du-chip")).map((n) => n.textContent || "").join("").replace(/\s+/g, " ").trim());
    return lines.length ? lines.join(" → ") : null;
  };
  const tabs = () => [...document.querySelectorAll('[role="tab"].mat-tab-label')];
  const save = () => chrome.storage.local.set({ labels });

  // Pestaña sin etiqueta en la misma posición que una etiqueta cuya búsqueda ya no existe: se movió el origen
  function migrate() {
    const list = tabs();
    const present = new Set(list.map(keyOf).filter(Boolean));
    let changed = false;
    list.forEach((tab, index) => {
      const key = keyOf(tab);
      if (!key || labels[key]) return;
      const orphan = Object.keys(labels).find((k) => !present.has(k) && labels[k].index === index);
      if (orphan) { labels[key] = { ...labels[orphan] }; delete labels[orphan]; changed = true; }
    });
    list.forEach((tab, index) => {
      const key = keyOf(tab);
      if (key && labels[key] && labels[key].index !== index) { labels[key].index = index; changed = true; }
    });
    if (changed) save();
  }

  function render() {
    migrate();
    tabs().forEach((tab) => {
      const key = keyOf(tab);
      // En la línea del destino ("Anywhere"), que tiene espacio: así no se corta el origen
      const rows = tab.querySelectorAll(".load-details > div");
      const firstLine = rows[1] || rows[0];
      if (!key || !firstLine) return;
      let chip = tab.querySelector(".du-chip");
      if (chip && chip.parentElement !== firstLine) { chip.remove(); chip = null; }
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "du-chip";
        chip.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); openEditor(tab, chip); }, true);
        firstLine.prepend(chip);
      }
      const label = labels[key];
      const text = label ? label.name : "+ driver";
      if (chip.textContent !== text) chip.textContent = text;
      chip.classList.toggle("du-empty", !label);
      chip.style.background = label ? label.color : "";
      chip.title = label ? `Driver: ${label.name} (clic para cambiar)` : "Ponle el nombre del driver a esta búsqueda";
    });
  }

  function openEditor(tab, chip) {
    document.querySelector(".du-pop")?.remove();
    const key = keyOf(tab);
    if (!key) return;
    const current = labels[key];
    const names = [...new Set(Object.values(labels).map((l) => l.name))].sort();
    let color = current?.color || COLORS[Object.keys(labels).length % COLORS.length];

    const pop = document.createElement("div");
    pop.className = "du-pop";
    pop.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">Driver de esta búsqueda</div>
      <input list="du-names" placeholder="Nombre del driver">
      <datalist id="du-names">${names.map((n) => `<option value="${n.replace(/"/g, "&quot;")}">`).join("")}</datalist>
      <div class="du-colors">${COLORS.map((c) => `<span class="du-color" data-c="${c}" style="background:${c}"></span>`).join("")}</div>
      <div class="du-actions">
        ${current ? '<button class="du-clear">Quitar</button>' : ""}
        <button class="du-cancel">Cancelar</button>
        <button class="du-save">Guardar</button>
      </div>`;
    const input = pop.querySelector("input");
    input.value = current?.name || "";
    const paint = () => pop.querySelectorAll(".du-color").forEach((s) => s.classList.toggle("du-on", s.dataset.c === color));
    pop.querySelectorAll(".du-color").forEach((s) => s.addEventListener("click", () => { color = s.dataset.c; paint(); }));
    paint();

    const close = () => { pop.remove(); document.removeEventListener("mousedown", outside, true); };
    const outside = (e) => { if (!pop.contains(e.target)) close(); };
    const commit = () => {
      const name = input.value.trim();
      if (name) labels[key] = { name, color, index: tabs().indexOf(tab) };
      else delete labels[key];
      save(); render(); close();
    };
    pop.querySelector(".du-save").addEventListener("click", commit);
    pop.querySelector(".du-cancel").addEventListener("click", close);
    pop.querySelector(".du-clear")?.addEventListener("click", () => { delete labels[key]; save(); render(); close(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") close(); e.stopPropagation(); });

    const r = chip.getBoundingClientRect();
    pop.style.left = `${Math.min(r.left, window.innerWidth - 250)}px`;
    pop.style.top = `${r.bottom + 6}px`;
    document.body.appendChild(pop);
    setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
    input.focus();
    input.select();
  }

  chrome.storage.local.get("labels", (data) => {
    labels = data.labels || {};
    render();
    // DAT redibuja las pestañas al buscar o cambiar de pestaña: se vuelve a poner la etiqueta
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; render(); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.labels) { labels = changes.labels.newValue || {}; render(); }
  });
})();

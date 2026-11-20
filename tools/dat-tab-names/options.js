// Configuración del email al broker (cuenta de Gmail, asunto y mensaje con variables)
const $ = (id) => document.getElementById(id);
const SAMPLE = {
  broker: "Landstar Ranger Inc", origen: "Middlefield, OH", destino: "Aynor, SC", dho: 144, fecha: "11/20",
  millas: 659, equipo: "FH", peso: "1,000", largo: 16, rate: "$1,850", referencia: "57892", driver: "Julio Bolivar",
};
let lastField = $("body");

function preview() {
  $("preview").innerHTML = "";
  const s = document.createElement("div");
  s.className = "subject";
  s.textContent = duFillTemplate($("subject").value, SAMPLE);
  $("preview").append(s, document.createTextNode(duFillTemplate($("body").value, SAMPLE)));
}

function fill(cfg) {
  $("from").value = cfg.from || "";
  $("subject").value = cfg.subject;
  $("body").value = cfg.body;
  preview();
}

for (const [k, label] of DU_EMAIL_VARS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "var";
  b.textContent = `{${k}}`;
  b.title = label;
  b.addEventListener("click", () => {
    const el = lastField;
    const at = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, at) + `{${k}}` + el.value.slice(el.selectionEnd ?? at);
    el.focus();
    el.selectionStart = el.selectionEnd = at + k.length + 2;
    preview();
  });
  $("vars").append(b);
}

for (const id of ["subject", "body"]) {
  $(id).addEventListener("focus", () => (lastField = $(id)));
  $(id).addEventListener("input", preview);
}

$("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    emailCfg: { from: $("from").value.trim(), subject: $("subject").value, body: $("body").value },
  });
  $("saved").style.opacity = 1;
  setTimeout(() => ($("saved").style.opacity = 0), 1800);
});

$("reset").addEventListener("click", () => fill({ ...DU_EMAIL_DEFAULTS, from: $("from").value }));

chrome.storage.sync.get("emailCfg").then(({ emailCfg }) => fill({ ...DU_EMAIL_DEFAULTS, ...(emailCfg || {}) }));

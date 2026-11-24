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

const mode = () => document.querySelector('input[name="mode"]:checked')?.value || "direct";
function showMode() {
  $("directBox").style.display = mode() === "direct" ? "" : "none";
  $("gmailBox").style.display = mode() === "gmail" ? "" : "none";
}
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", showMode));

// Cuentas de envío configuradas en Dispatch Up (se piden con la clave)
async function loadAccounts(selected) {
  const r = await chrome.runtime.sendMessage({ type: "broker-email-send", payload: { action: "check" } }).catch(() => null);
  const list = r?.accounts?.length ? r.accounts : ["58logisticsllc@gmail.com"];
  const want = selected || $("sendFrom").value || r?.from;
  $("sendFrom").innerHTML = "";
  for (const a of list) {
    const o = document.createElement("option");
    o.value = o.textContent = a;
    $("sendFrom").append(o);
  }
  if (want && !list.includes(want)) {
    const o = document.createElement("option");
    o.value = want; o.textContent = `${want} (no configurada)`;
    $("sendFrom").append(o);
  }
  $("sendFrom").value = want || list[0];
  return r;
}

function fill(cfg) {
  $("from").value = cfg.from || "";
  $("fromName").value = cfg.fromName || "";
  loadAccounts(cfg.sendFrom);
  const m = document.querySelector(`input[name="mode"][value="${cfg.mode || "direct"}"]`);
  if (m) m.checked = true;
  showMode();
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
    emailCfg: {
      mode: mode(), from: $("from").value.trim(), sendFrom: $("sendFrom").value, fromName: $("fromName").value.trim(),
      subject: $("subject").value, body: $("body").value,
    },
  });
  await chrome.storage.sync.set({ duKey: $("key").value.trim() });
  $("saved").style.opacity = 1;
  setTimeout(() => ($("saved").style.opacity = 0), 1800);
});

$("reset").addEventListener("click", () => fill({ ...DU_EMAIL_DEFAULTS, mode: mode(), from: $("from").value, sendFrom: $("sendFrom").value, fromName: $("fromName").value }));

// Probar la clave: guarda y pregunta a Dispatch Up si la cuenta de envío está lista
$("test").addEventListener("click", async () => {
  const st = $("keyStatus");
  st.className = "hint";
  st.textContent = "Probando…";
  await chrome.storage.sync.set({ duKey: $("key").value.trim() });
  const r = (await loadAccounts()) || { error: "No se pudo probar" };
  if (r?.ok) { st.className = "hint ok"; st.textContent = `✓ Clave correcta. Cuentas para enviar: ${(r.accounts || [r.from]).join(", ")}.`; }
  else { st.className = "hint bad"; st.textContent = r?.error || "No se pudo probar"; }
});

Promise.all([chrome.storage.sync.get("duKey"), chrome.storage.local.get("duKey")])
  .then(([s, l]) => { $("key").value = s.duKey || l.duKey || ""; });

chrome.storage.sync.get("emailCfg").then(({ emailCfg }) => fill({ ...DU_EMAIL_DEFAULTS, mode: "direct", ...(emailCfg || {}) }));

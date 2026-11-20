// Plantilla del email al broker: valores por defecto y reemplazo de variables.
// Lo usan broker-email.js (en DAT) y options.js (página de configuración).
const DU_EMAIL_DEFAULTS = {
  from: "",
  subject: "Load {origen} → {destino} | {fecha}",
  body:
    "Hello {broker} team,\n\n" +
    "I'm interested in your load from {origen} to {destino} on {fecha}.\n" +
    "My truck is {dho} miles away from pickup and ready to go.\n\n" +
    "Is it still available? What's the best rate you can offer?\n\n" +
    "Thank you,\n" +
    "58 Logistics LLC\n" +
    "MC# 1708664",
};

const DU_EMAIL_VARS = [
  ["broker", "Nombre del broker"],
  ["origen", "Origen (ciudad, estado)"],
  ["destino", "Destino (ciudad, estado)"],
  ["dho", "DH-O: millas vacías hasta el pickup"],
  ["fecha", "Fecha de pickup (MM/DD)"],
  ["millas", "Millas cargadas"],
  ["equipo", "Equipo (FH, V, R…)"],
  ["peso", "Peso (lbs)"],
  ["largo", "Largo (ft)"],
  ["rate", "Rate publicado"],
  ["referencia", "Referencia del broker"],
  ["driver", "Nombre del driver de la pestaña de DAT"],
];

function duFillTemplate(text, vals) {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (vals[k] != null && vals[k] !== "" ? String(vals[k]) : m === "{rate}" ? "N/A" : ""));
}

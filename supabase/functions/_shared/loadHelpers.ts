// deno-lint-ignore-file no-explicit-any

/** true si la carga tiene documentos o fotos en alguna parada de entrega, o un PDF nombrado POD */
export async function loadHasPod(supabase: any, loadId: string): Promise<boolean> {
  const { data: stops } = await supabase
    .from("load_stops").select("id").eq("load_id", loadId).eq("stop_type", "delivery");
  const deliveryStopIds = ((stops as any[]) || []).map((s) => s.id);

  const { data: docs } = await supabase
    .from("pod_documents").select("stop_id, file_type, file_name").eq("load_id", loadId);

  return ((docs as any[]) || []).some((d) =>
    (d.stop_id && deliveryStopIds.includes(d.stop_id)) ||
    (d.file_type !== "image" && /pod/i.test(d.file_name || ""))
  );
}

/** "123 Main St, Columbia, SC 29201" → "Columbia, SC" */
export function cityState(address: string | null | undefined): string {
  if (!address) return "";
  const cleaned = address.replace(/\b\d{5}(-\d{4})?\b/g, "").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && !/^\d/.test(parts[parts.length - 1])) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return cleaned;
}

function to12h(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  const suffix = m[3]?.toLowerCase();
  if (suffix) {
    const pm = suffix.startsWith("p");
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || Number(min) > 59) return null;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${period}`;
}

/** Ventana horaria legible: "entre las 8:00 am y las 3:00 pm", "a las 2:00 pm" o "(FCFS)" */
export function timeWindow(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";
  const text = raw
    .replace(/\b(EDT|EST|CDT|CST|MDT|MST|PDT|PST|ET|CT|MT|PT)\b/gi, "")
    .replace(/(\d{1,2}:\d{2}):\d{2}/g, "$1")
    .trim();
  const range = text.split(/\s*[-–]\s*|\s+(?:to|a)\s+/i);
  if (range.length === 2) {
    const a = to12h(range[0]);
    const b = to12h(range[1]);
    if (a && b) return a === b ? `a las ${a}` : `entre las ${a} y las ${b}`;
  }
  const single = to12h(text);
  if (single) return `a las ${single}`;
  return `(${raw.trim()})`;
}

/** Fecha de hoy (YYYY-MM-DD) en hora del Este */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function usDate(d: string): string {
  const [y, m, day] = d.split("T")[0].split("-");
  return `${m}/${day}/${y}`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

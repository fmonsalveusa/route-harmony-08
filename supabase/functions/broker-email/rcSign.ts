// deno-lint-ignore-file no-explicit-any
// Rate confirmation firmado: se llena con la firma de la empresa y los datos del driver
// sobre el PDF original del broker. La IA no dibuja nada: solo elige, entre los textos del PDF
// (con su posición exacta), qué etiqueta corresponde a cada dato y de qué lado se escribe.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { getDocumentProxy } from "npm:unpdf@0.12.1";

export const RC_FIELDS = ["carrier_signature", "signer_name", "signer_title", "sign_date", "driver_name", "driver_phone", "truck_number"] as const;
type Field = typeof RC_FIELDS[number];
type Side = "right" | "above" | "below";

interface TextItem { id: number; page: number; x: number; y: number; w: number; h: number; str: string }
export interface Placement { field: Field; page: number; x: number; y: number; label?: string; appended?: boolean }

const INK = rgb(0.04, 0.1, 0.32);
const SIG_HEIGHT = 26;

/** Ruta dentro del bucket a partir de una ruta guardada o de una signed URL vieja */
export function storagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https?:/i.test(url)) return url.replace(/^\/+/, "").replace(/^driver-documents\//, "");
  const m = url.match(/\/driver-documents\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function textItems(pdfBytes: Uint8Array, maxPages = 6): Promise<{ items: TextItem[]; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const items: TextItem[] = [];
  const pages = Math.min(pdf.numPages, maxPages);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      const str = String(it.str ?? "").trim();
      if (!str) continue;
      items.push({
        id: items.length, page: p - 1,
        x: it.transform[4], y: it.transform[5],
        w: it.width ?? 0, h: it.height || Math.abs(it.transform[3]) || 8,
        str,
      });
    }
  }
  return { items, pages: pdf.numPages };
}

/** La IA elige, para cada dato, la etiqueta del PDF donde va y de qué lado escribirlo */
async function locateFields(items: TextItem[]): Promise<Partial<Record<Field, { item: number; side: Side }>>> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");
  // Solo lo necesario para que la IA entienda la hoja: id, página, posición y texto
  const listing = items.map((i) => `${i.id}|p${i.page + 1}|x${Math.round(i.x)}|y${Math.round(i.y)}|${i.str.slice(0, 80)}`).join("\n");

  const properties: Record<string, unknown> = {};
  for (const f of RC_FIELDS) {
    properties[f] = {
      type: ["object", "null"],
      properties: {
        item: { type: "integer", description: "id del texto-etiqueta junto al que se escribe el dato" },
        label: { type: "string", description: "las palabras exactas de la etiqueta dentro de ese texto (p. ej. \"Driver Phone #\"). Importante cuando un mismo texto trae varias etiquetas en la misma línea" },
        side: { type: "string", enum: ["right", "above", "below"], description: "right = a continuación de la etiqueta; above = encima (la etiqueta está debajo de una línea en blanco); below = debajo" },
      },
      required: ["item", "side"],
    };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      system: `Recibes los textos de un rate confirmation de un broker de carga (USA), uno por línea: id|página|x|y|texto.
Las coordenadas son de PDF: x crece a la derecha, y crece hacia ARRIBA.
Tu trabajo: ubicar dónde debe firmar y llenar sus datos el CARRIER (no el broker).
Para cada campo devuelve el id de la ETIQUETA junto a la que se escribe y el lado:
- carrier_signature: la línea de firma del carrier ("Carrier Signature", "Signature", "Signed", "Accepted by" en la sección del carrier).
- signer_name: nombre impreso de quien firma por el carrier ("Print Name", "Name").
- signer_title: cargo ("Title").
- sign_date: fecha de la firma del carrier ("Date").
- driver_name, driver_phone, truck_number: datos del driver/camión ("Driver Name", "Driver Cell", "Truck #", "Tractor #", "Unit").
Si una sola línea trae varias etiquetas (p. ej. "Driver name: ____ Driver Phone # ____ Tractor #: ____"), usa el mismo id para cada campo y en "label" pon las palabras exactas de la etiqueta de ese campo.
Reglas: usa solo campos en blanco del carrier; nunca la firma o los datos del broker. Si un campo no existe en el documento, devuélvelo null. Si el texto ya trae el dato lleno, null.`,
      tools: [{ name: "ubicar", description: "Ubicación de cada campo", input_schema: { type: "object", properties, required: [...RC_FIELDS] } }],
      // Este modelo no admite forzar la herramienta: se pide en el mensaje
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: `${listing.slice(0, 60000)}

Responde llamando a la herramienta "ubicar".` }],
    }),
  });
  if (!res.ok) throw new Error(`IA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return ((data.content ?? []).find((c: any) => c.type === "tool_use")?.input ?? {}) as any;
}

/** ¿Ya hay algo escrito en el espacio del dato? (p. ej. el RC ya venía firmado por el dispatcher) */
function occupied(items: TextItem[], label: TextItem, side: Side, at: { x: number; y: number }, span: number): string | null {
  const blank = (t: string) => /^[_xX.\s:-]*$/.test(t);
  // Otras etiquetas o párrafos no cuentan como "ya escrito": solo un valor corto (un nombre, un número)
  const isValue = (t: string) =>
    t.length <= 40 && !/[:#]\s*$/.test(t) &&
    !/\b(name|phone|cell|date|signature|signed|title|truck|tractor|trailer|unit|driver|carrier|broker)\b/i.test(t);
  const hit = items.find((i) => {
    if (i.page !== label.page || i.id === label.id || blank(i.str) || !isValue(i.str)) return false;
    const overlapsX = i.x + i.w > at.x - 2 && i.x < at.x + span;
    if (side === "right") return Math.abs(i.y - label.y) < Math.max(label.h, 8) * 1.3 && overlapsX;
    if (side === "above") return i.y > label.y + label.h * 0.5 && i.y < label.y + label.h + 30 && overlapsX;
    return i.y < label.y - label.h * 0.5 && i.y > label.y - label.h - 30 && overlapsX;
  });
  return hit ? hit.str : null;
}

type Measure = (t: string) => number;

/**
 * Dónde se escribe el dato y cuánto espacio hay. Si el texto trae varias etiquetas en la misma línea
 * ("Driver name: ____ Driver Phone # ____"), se ubica la de este campo y su raya en blanco.
 * La posición dentro del texto se estima con el ancho proporcional de los caracteres.
 */
function anchor(item: TextItem, side: Side, measure: Measure, label?: string): { x: number; y: number; room: number | null } {
  if (side === "above") return { x: item.x, y: item.y + item.h + 3, room: null };
  if (side === "below") return { x: item.x, y: item.y - item.h - 3, room: null };

  const str = item.str;
  const total = measure(str) || 1;
  const at = (i: number) => item.x + item.w * (measure(str.slice(0, i)) / total);
  let from = 0;
  if (label) {
    const idx = str.toLowerCase().indexOf(label.toLowerCase().trim());
    if (idx >= 0) from = idx + label.trim().length;
  }
  const rest = str.slice(from);
  const run = rest.match(/_{2,}/);
  if (run && run.index !== undefined) {
    const start = from + run.index;
    return { x: at(start) + 2, y: item.y + 1, room: at(start + run[0].length) - at(start) - 4 };
  }
  // Sin raya: justo después de la etiqueta (o del texto completo)
  if (from > 0) {
    const next = rest.search(/\S/);
    return { x: at(from + Math.max(next, 0)) + 4, y: item.y, room: null };
  }
  return { x: item.x + item.w + 6, y: item.y, room: null };
}

export interface RcData {
  signerName: string;
  signerTitle: string;
  driverName: string;
  driverPhone: string;
  truckNumber: string;
  date: string;          // MM/DD/YYYY
  reference: string;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

type VisionSpot = { page: number; x: number; y: number };

/**
 * RC escaneado (la página es una imagen, sin texto): la IA mira el PDF y estima dónde empieza
 * la raya en blanco de cada campo. Coordenadas en fracción de la página, y medida desde ARRIBA.
 */
async function locateFieldsVision(pdfBytes: Uint8Array): Promise<Partial<Record<Field, VisionSpot>>> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");
  const properties: Record<string, unknown> = {};
  for (const f of RC_FIELDS) {
    properties[f] = {
      type: ["object", "null"],
      properties: {
        page: { type: "integer", description: "página, empezando en 1" },
        x: { type: "number", description: "borde IZQUIERDO de la raya en blanco, fracción del ancho de la página (0 a 1)" },
        y: { type: "number", description: "altura de la raya en blanco (la línea donde se escribe), fracción del alto de la página medida desde ARRIBA (0 a 1)" },
      },
      required: ["page", "x", "y"],
    };
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      system: `Recibes un rate confirmation de un broker de carga (USA), escaneado como imagen.
Ubica los espacios en blanco que debe llenar el CARRIER (no el broker):
- carrier_signature: la raya de firma del carrier ("Signature", "Carrier Signature", "Accepted by").
- signer_name: nombre impreso ("Print Name", "Name"). signer_title: cargo ("Title"). sign_date: fecha de la firma ("Date").
- driver_name, driver_phone, truck_number: datos del driver/camión si hay espacio para ellos.
Para cada uno da la página y la posición donde EMPIEZA la raya en blanco (a la derecha de la etiqueta) y la altura de esa raya.
Sé preciso con las coordenadas: mide sobre la imagen de la página. Si un campo no existe o ya está lleno, null.`,
      tools: [{ name: "ubicar", description: "Ubicación de cada campo", input_schema: { type: "object", properties, required: [...RC_FIELDS] } }],
      tool_choice: { type: "auto" },
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(pdfBytes) } },
          { type: "text", text: 'Responde llamando a la herramienta "ubicar".' },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`IA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return ((data.content ?? []).find((c: any) => c.type === "tool_use")?.input ?? {}) as any;
}

export async function buildSignedRc(pdfBytes: Uint8Array, signaturePng: Uint8Array, data: RcData) {
  const { items } = await textItems(pdfBytes);
  // Casi sin texto = PDF escaneado: se ubican los campos mirando la imagen
  const scanned = items.length < 5;
  const found = !scanned ? await locateFields(items) : {};
  const seen = scanned ? await locateFieldsVision(pdfBytes) : {};

  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  try { doc.getForm().flatten(); } catch { /* sin formulario */ }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sig = await doc.embedPng(signaturePng);
  const sigW = (sig.width / sig.height) * SIG_HEIGHT;
  const pages = doc.getPages();
  const placements: Placement[] = [];
  const skipped: { field: Field; found: string }[] = [];

  const values: Record<Exclude<Field, "carrier_signature">, string> = {
    signer_name: data.signerName,
    signer_title: data.signerTitle,
    sign_date: data.date,
    driver_name: data.driverName,
    driver_phone: data.driverPhone,
    truck_number: data.truckNumber,
  };

  for (const field of RC_FIELDS) {
    const spot = (found as any)[field];
    const item = spot ? items[spot.item] : undefined;
    if (!item || !pages[item.page]) continue;
    const page = pages[item.page];
    const { width: pw } = page.getSize();
    const { x, y, room } = anchor(item, spot.side, (t) => font.widthOfTextAtSize(t, 10), spot.label);
    const already = occupied(items, item, spot.side, { x, y }, field === "carrier_signature" ? 200 : 120);
    if (already) { skipped.push({ field, found: already }); continue; }
    if (field === "carrier_signature") {
      const sx = Math.min(x, pw - sigW - 10);
      page.drawImage(sig, { x: sx, y: spot.side === "right" ? y - 8 : y, width: sigW, height: SIG_HEIGHT });
      placements.push({ field, page: item.page, x: sx, y, label: item.str });
    } else {
      const text = values[field];
      if (!text) continue;
      let size = Math.min(Math.max(item.h, 8), 11);
      // Que no se pase de la raya hacia la etiqueta siguiente
      if (room && room > 20) while (size > 6 && font.widthOfTextAtSize(text, size) > room) size -= 0.5;
      page.drawText(text, { x: Math.min(x, pw - font.widthOfTextAtSize(text, size) - 8), y, size, font, color: INK });
      placements.push({ field, page: item.page, x, y, label: item.str });
    }
  }

  // PDF escaneado: se escribe en las rayas que la IA ubicó sobre la imagen
  for (const field of RC_FIELDS) {
    const spot = (seen as any)[field] as VisionSpot | null | undefined;
    const page = spot ? pages[spot.page - 1] : undefined;
    if (!spot || !page || !(spot.x >= 0 && spot.x < 1 && spot.y > 0 && spot.y < 1)) continue;
    const { width: pw, height: ph } = page.getSize();
    const x = spot.x * pw + 3;
    const lineY = ph * (1 - spot.y);
    if (field === "carrier_signature") {
      const sx = Math.min(x, pw - sigW - 10);
      page.drawImage(sig, { x: sx, y: lineY - 4, width: sigW, height: SIG_HEIGHT });
      placements.push({ field, page: spot.page - 1, x: sx, y: lineY, label: "(escaneado)" });
    } else {
      const text = values[field];
      if (!text) continue;
      page.drawText(text, { x: Math.min(x, pw - font.widthOfTextAtSize(text, 10) - 8), y: lineY + 2, size: 10, font, color: INK });
      placements.push({ field, page: spot.page - 1, x, y: lineY, label: "(escaneado)" });
    }
  }

  // Sin línea de firma reconocible: se agrega una hoja de aceptación del carrier al final
  const alreadySigned = skipped.some((s) => s.field === "carrier_signature");
  if (!alreadySigned && !placements.some((p) => p.field === "carrier_signature")) {
    const page = doc.addPage([612, 792]);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 700;
    page.drawText(`Carrier Acceptance - Load #${data.reference}`, { x: 60, y, size: 16, font: bold });
    y -= 40;
    const rows: [string, string][] = [
      ["Signed by", `${data.signerName} - ${data.signerTitle}`],
      ["Date", data.date],
      ["Driver", data.driverName],
      ["Driver phone", data.driverPhone],
      ["Truck #", data.truckNumber],
    ];
    for (const [k, v] of rows) {
      if (!v) continue;
      page.drawText(`${k}:`, { x: 60, y, size: 11, font: bold });
      page.drawText(v, { x: 170, y, size: 11, font, color: INK });
      y -= 24;
    }
    page.drawText("Signature:", { x: 60, y: y - 20, size: 11, font: bold });
    page.drawImage(sig, { x: 170, y: y - 30, width: sigW * 1.3, height: SIG_HEIGHT * 1.3 });
    placements.push({ field: "carrier_signature", page: pages.length, x: 170, y: y - 30, appended: true });
  }

  return { bytes: await doc.save(), placements, skipped, alreadySigned };
}

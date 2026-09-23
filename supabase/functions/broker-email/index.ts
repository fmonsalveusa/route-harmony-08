// deno-lint-ignore-file no-explicit-any
// Emails automáticos al broker, como respuesta dentro del hilo de Gmail de la carga.
//  • arrival: el driver llegó a una parada (GPS o manual) → "llegó y espera"
//  • docs: se subieron fotos/BOL/POD a una parada → email con los archivos adjuntos
//  • process: cron cada 5 min (docs pendientes y reintentos)
//  • search / link / retry: acciones desde el TMS (usuario autenticado)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { sendMail } from "../_shared/smtp.ts";
import { cityState } from "../_shared/loadHelpers.ts";
import { isEnabled, renderMessage } from "../_shared/messaging.ts";
import { findLoadThreads, gmailAccounts, replyTarget, searchThreads, type GmailAccount } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DOCS_DELAY_MIN = 10;        // sin BOL/POD todavía: espera por si aparece
const DOCS_SETTLE_MIN = 3;        // ya hay BOL/POD: espera corta por si faltan fotos
const DOCS_MAX_DELAY_MIN = 15;    // tope desde el primer archivo de la parada
const ARRIVAL_MAX_AGE_H = 3;      // "llegó y espera" ya no sirve después
const DOCS_MAX_AGE_H = 72;
const RESEARCH_EVERY_MIN = 30;    // volver a buscar el hilo si no estaba
const MAX_ATTACH_BYTES = 12 * 1024 * 1024;   // tope de adjuntos: más que esto agota la memoria de la función
const MAX_CLASSIFY_BYTES = 3.5 * 1024 * 1024; // la API de imágenes no acepta fotos más grandes
const TOGGLES: Record<string, string> = { arrival: "email_broker_arrival", docs: "email_broker_docs" };

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** Cuándo mandar el email de documentos: corto si ya hay BOL/POD, con tope desde el primer archivo */
const docsDueAt = (createdAt: string, hasDoc: boolean) => {
  const wait = Date.now() + (hasDoc ? DOCS_SETTLE_MIN : DOCS_DELAY_MIN) * 60_000;
  const cap = Date.parse(createdAt) + DOCS_MAX_DELAY_MIN * 60_000;
  return new Date(Math.min(wait, cap)).toISOString();
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── Encolar ───

async function enqueue(supabase: any, kind: "arrival" | "docs", stopId: string) {
  const { data: stop } = await supabase
    .from("load_stops").select("id, load_id, stop_type, stop_order, address").eq("id", stopId).maybeSingle();
  if (!stop) return { skipped: "stop not found" };

  const { data: load } = await supabase
    .from("loads").select("id, tenant_id, status").eq("id", stop.load_id).maybeSingle();
  if (!load || load.status === "cancelled") return { skipped: "no load or cancelled" };
  if (!(await isEnabled(supabase, load.tenant_id, TOGGLES[kind]))) return { skipped: "disabled" };

  // Uno por parada. La clave va por número de parada: los ids cambian al editar la carga.
  const key = `${kind}:${load.id}:${stop.stop_type}:${stop.stop_order ?? 0}`;
  const { data: existing } = await supabase
    .from("broker_email_queue").select("*").eq("message_key", key).maybeSingle();

  if (existing) {
    // Llegan más archivos de la misma parada: se corre la salida para mandarlos todos juntos
    if (kind === "docs" && existing.status === "pending") {
      const sendAfter = docsDueAt(existing.created_at, await hasDocument(supabase, stop.id));
      await supabase.from("broker_email_queue").update({ send_after: sendAfter }).eq("id", existing.id);
      if (Date.parse(sendAfter) <= Date.now()) return await processRow(supabase, { ...existing, send_after: sendAfter });
    }
    // Quedó sin enviar o falló y ahora llegan archivos nuevos: se vuelve a abrir
    if (["skipped", "failed"].includes(existing.status)) {
      const sendAfter = kind === "docs"
        ? docsDueAt(new Date().toISOString(), await hasDocument(supabase, stop.id))
        : new Date().toISOString();
      const { data: reopened } = await supabase.from("broker_email_queue")
        .update({ status: "pending", attempts: 0, error: null, sent_at: null, created_at: new Date().toISOString(), send_after: sendAfter })
        .eq("id", existing.id).select("*").single();
      if (!reopened) return { skipped: "no se pudo reabrir" };
      if (Date.parse(sendAfter) <= Date.now()) return await processRow(supabase, reopened);
      return { requeued: reopened.id };
    }
    // Después de enviado solo se vuelve a escribir si llegó el BOL/POD. Las fotos sueltas no generan emails.
    if (kind === "docs" && existing.status === "sent") {
      const since = await lastDocsSentAt(supabase, existing);
      const nuevos = (await stopDocuments(supabase, existing))
        .filter((d) => !since || Date.parse(d.created_at) > Date.parse(since));
      if (nuevos.length === 0) return { skipped: "nothing new" };
      await classifyImages(supabase, nuevos);
      if (!nuevos.some((d) => !isImageDoc(d) || d.is_document === true)) return { skipped: "solo fotos nuevas" };
      return await enqueueUpdate(supabase, existing);
    }
    return { skipped: `already ${existing.status}` };
  }

  const { data: row, error } = await supabase.from("broker_email_queue").insert({
    tenant_id: load.tenant_id,
    load_id: load.id,
    kind,
    stop_type: stop.stop_type,
    stop_order: stop.stop_order ?? 0,
    city: cityState(stop.address),
    message_key: key,
    send_after: kind === "docs"
      ? docsDueAt(new Date().toISOString(), await hasDocument(supabase, stop.id))
      : new Date().toISOString(),
  }).select("*").single();
  if (error) return { skipped: "already queued" };

  if (kind === "arrival" || Date.parse(row.send_after) <= Date.now()) return await processRow(supabase, row);
  return { queued: row.id };
}

/** ¿La parada ya tiene el BOL/POD? (un PDF, o una foto del papel detectada por la IA) */
async function hasDocument(supabase: any, stopId: string): Promise<boolean> {
  const { data: docs } = await supabase
    .from("pod_documents").select("id, file_url, file_name, file_type, is_document").eq("stop_id", stopId);
  const list = ((docs as any[]) || []).filter((d) => d.file_url);
  if (list.some((d) => !isImageDoc(d))) return true;
  // Cada foto se analiza una sola vez: el resultado queda guardado en pod_documents
  await classifyImages(supabase, list);
  return list.some((d) => d.is_document === true);
}

/** Email de actualización de documentos (uno pendiente a la vez por parada) */
async function enqueueUpdate(supabase: any, base: any) {
  const { data: updates } = await supabase
    .from("broker_email_queue").select("id, status")
    .like("message_key", `${base.message_key}:update:%`)
    .order("created_at", { ascending: false });
  const list = (updates as any[]) || [];
  const open = list.find((u) => ["pending", "waiting_thread"].includes(u.status));
  if (open) {
    await supabase.from("broker_email_queue").update({ send_after: minutesFromNow(DOCS_SETTLE_MIN) }).eq("id", open.id);
    return { skipped: "update already queued" };
  }
  const { data: row, error } = await supabase.from("broker_email_queue").insert({
    tenant_id: base.tenant_id,
    load_id: base.load_id,
    kind: "docs",
    stop_type: base.stop_type,
    stop_order: base.stop_order,
    city: base.city,
    message_key: `${base.message_key}:update:${list.length + 1}`,
    send_after: minutesFromNow(DOCS_SETTLE_MIN),
  }).select("id").single();
  if (error) return { skipped: "update already queued" };
  return { queued_update: row.id };
}

const isUpdateRow = (row: any) => String(row.message_key ?? "").includes(":update:");

/** Momento del último email de documentos enviado para la parada de esta fila */
async function lastDocsSentAt(supabase: any, row: any): Promise<string | null> {
  const base = String(row.message_key).split(":update:")[0];
  const { data } = await supabase
    .from("broker_email_queue").select("sent_at")
    .or(`message_key.eq."${base}",message_key.like."${base}:update:*"`)
    .eq("status", "sent").not("sent_at", "is", null)
    .order("sent_at", { ascending: false }).limit(1);
  return (data as any[])?.[0]?.sent_at ?? null;
}

// ─── Hilo de Gmail de la carga ───

async function ensureThread(supabase: any, load: any, accounts: GmailAccount[]) {
  const { data: existing } = await supabase.from("load_email_threads").select("*").eq("load_id", load.id).maybeSingle();
  if (existing?.status === "linked") return existing;
  if (existing?.searched_at && Date.parse(existing.searched_at) > Date.now() - RESEARCH_EVERY_MIN * 60_000) return existing;

  const candidates = await findLoadThreads(accounts, load.reference_number);
  const single = candidates.length === 1 ? candidates[0] : null;
  const row = {
    load_id: load.id,
    tenant_id: load.tenant_id,
    status: single ? "linked" : candidates.length === 0 ? "not_found" : "ambiguous",
    link_mode: single ? "auto" : null,
    account: single?.account ?? null,
    thread_id: single?.threadId ?? null,
    subject: single?.subject ?? null,
    candidates,
    searched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await supabase.from("load_email_threads").upsert(row, { onConflict: "load_id" });
  return row;
}

/** Aviso en el TMS para enlazar el hilo (uno por carga cada 12 horas) */
async function notifyThreadNeeded(supabase: any, load: any, thread: any) {
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: recent } = await supabase
    .from("notifications").select("id")
    .eq("load_id", load.id).eq("type", "broker_email_thread").gte("created_at", since).limit(1);
  if (recent && recent.length > 0) return;

  const message = thread.status === "ambiguous"
    ? `Hay ${thread.candidates?.length ?? 2} hilos de Gmail con el número de la carga #${load.reference_number}. Elige el correcto en el detalle de la carga para enviar los avisos al broker.`
    : `No encontré el hilo de Gmail del broker para la carga #${load.reference_number}. Enlázalo en el detalle de la carga para enviar los avisos.`;
  await supabase.from("notifications").insert({
    tenant_id: load.tenant_id,
    type: "broker_email_thread",
    title: "Email al broker pendiente",
    message,
    load_id: load.id,
  });
}

// ─── Fotos que en realidad son el BOL/POD ───

const base64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
};

/** true si la foto es el papel del BOL/POD, false si es una foto normal de la carga */
async function looksLikeDocument(bytes: Uint8Array, fileName: string): Promise<boolean | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  if (bytes.length > MAX_CLASSIFY_BYTES) {
    console.log(`Foto muy pesada para analizar (${Math.round(bytes.length / 1024)} KB): ${fileName}`);
    return null;
  }
  const mime = /\.png$/i.test(fileName) ? "image/png" : /\.webp$/i.test(fileName) ? "image/webp" : "image/jpeg";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 128,
        tools: [{
          name: "classify_photo",
          description: "Clasifica la foto subida por un driver en una parada de una carga",
          input_schema: {
            type: "object",
            properties: {
              is_document: {
                type: "boolean",
                description: "true SOLO si la foto es de un papel impreso tipo Bill of Lading, Proof of Delivery o packing list: se ven campos impresos, texto legible, firmas o sellos, y el papel ocupa casi toda la imagen. false para cualquier otra cosa: fotos de la carga, cajas, pallets, etiquetas sueltas, el trailer, el sello, el muelle, la puerta, la calle. Ante la duda, false.",
              },
            },
            required: ["is_document"],
          },
        }],
        tool_choice: { type: "tool", name: "classify_photo" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64(bytes) } },
            { type: "text", text: "¿Esta foto es un documento de la carga (BOL/POD) o una foto normal de la carga?" },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const input = (data.content ?? []).find((c: any) => c.type === "tool_use")?.input;
    return typeof input?.is_document === "boolean" ? input.is_document : null;
  } catch (e) {
    console.error("looksLikeDocument failed:", errMsg(e));
    return null;
  }
}

/** Analiza las fotos sin clasificar y guarda el resultado (una sola vez por foto) */
async function classifyImages(supabase: any, docs: any[]): Promise<any[]> {
  for (const d of docs) {
    if (!isImageDoc(d) || d.is_document !== null || !d.file_url) continue;
    const bytes = await downloadStorageFile(supabase, d.file_url);
    if (!bytes) continue;
    const result = await looksLikeDocument(bytes, d.file_name || "");
    if (result === null) continue;
    d.is_document = result;
    await supabase.from("pod_documents").update({ is_document: result }).eq("id", d.id);
  }
  return docs;
}

async function stopDocuments(supabase: any, row: { load_id: string; stop_type: string; stop_order: number }) {
  const { data: stops } = await supabase
    .from("load_stops").select("id").eq("load_id", row.load_id).eq("stop_type", row.stop_type).eq("stop_order", row.stop_order);
  const stopIds = ((stops as any[]) || []).map((s) => s.id);
  if (stopIds.length === 0) return [];
  const { data: docs } = await supabase
    .from("pod_documents").select("id, file_url, file_name, file_type, is_document, created_at").in("stop_id", stopIds).order("created_at");
  return ((docs as any[]) || []).filter((d) => d.file_url);
}

// ─── Adjuntos ───

async function downloadStorageFile(supabase: any, fileUrl: string): Promise<Uint8Array | null> {
  try {
    let filePath = fileUrl;
    const m = fileUrl.match(/\/object\/(?:sign|public)\/([^?]+)/);
    if (m) filePath = decodeURIComponent(m[1]);
    const bucket = "driver-documents";
    const path = filePath.startsWith(`${bucket}/`) ? filePath.substring(bucket.length + 1) : filePath;
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

function contentTypeOf(name: string, fileType: string | null): string {
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.(jpe?g)$/i.test(name) || fileType === "image") return "image/jpeg";
  return "application/octet-stream";
}

type Attachment = { filename: string; content: Uint8Array; encoding: "binary"; contentType: string };

const isImageDoc = (d: any) => d.file_type === "image" || /\.(jpe?g|png|gif|webp|heic)$/i.test(d.file_name || "");


const MAX_ATTACHMENTS = 12;

/**
 * Adjuntos de la parada: un solo BOL/POD en PDF (los PDF y las fotos del papel, en una
 * sola pasada) más las fotos de la carga. En un email de actualización (since) el PDF
 * solo va si llegó un documento nuevo, y las fotos solo si son nuevas.
 */
async function stopAttachments(supabase: any, row: any, reference: string, since: string | null) {
  const all = await classifyImages(supabase, await stopDocuments(supabase, row));
  if (all.length === 0) return { files: [] as Attachment[], skippedNames: [] as string[] };
  const isNew = (d: any) => !since || Date.parse(d.created_at) > Date.parse(since);

  const docParts = all.filter((d) => !isImageDoc(d) || d.is_document === true);
  const includeDoc = docParts.length > 0 && docParts.some(isNew);
  if (since && !includeDoc) return { files: [] as Attachment[], skippedNames: [] as string[] };
  const photos = all.filter((d) => isImageDoc(d) && d.is_document !== true && isNew(d)).slice(0, MAX_ATTACHMENTS);

  const files: Attachment[] = [];
  const skippedNames: string[] = [];
  let total = 0;
  const fits = (name: string, size: number) => {
    if (total + size > MAX_ATTACH_BYTES) { skippedNames.push(name); return false; }
    total += size;
    return true;
  };

  // El BOL/POD completo, armado de una sola vez
  if (includeDoc) {
    const doc = await PDFDocument.create();
    let pages = 0;
    for (const d of docParts) {
      const name = d.file_name || "documento";
      const bytes = await downloadStorageFile(supabase, d.file_url);
      if (!bytes) { skippedNames.push(name); continue; }
      try {
        if (isImageDoc(d)) {
          const img = /\.png$/i.test(name) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          doc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          pages++;
        } else {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          (await doc.copyPages(src, src.getPageIndices())).forEach((pg) => doc.addPage(pg));
          pages += src.getPageCount();
        }
      } catch {
        // El archivo que no se pueda leer va adjunto tal cual
        if (fits(name, bytes.length)) {
          files.push({ filename: name, content: bytes, encoding: "binary", contentType: contentTypeOf(name, d.file_type) });
        }
      }
    }
    if (pages > 0) {
      const label = row.stop_type === "pickup" ? "BOL" : "POD";
      const safeRef = String(reference || "load").replace(/[^A-Za-z0-9_-]/g, "");
      const bytes = await doc.save();
      if (fits(`${label}_${safeRef}.pdf`, bytes.length)) {
        files.unshift({ filename: `${label}_${safeRef}.pdf`, content: bytes, encoding: "binary", contentType: "application/pdf" });
      }
    }
  }

  for (const d of photos) {
    const name = d.file_name || `photo_${files.length + 1}.jpg`;
    const bytes = await downloadStorageFile(supabase, d.file_url);
    if (!bytes) { skippedNames.push(name); continue; }
    if (files.length >= MAX_ATTACHMENTS) { skippedNames.push(name); continue; }
    if (fits(name, bytes.length)) {
      files.push({ filename: name, content: bytes, encoding: "binary", contentType: contentTypeOf(name, d.file_type) });
    }
  }
  // Las fotos suelen llegar con el mismo nombre: se numeran para que el broker las distinga
  const seen = new Map<string, number>();
  for (const f of files) {
    const n = (seen.get(f.filename) ?? 0) + 1;
    seen.set(f.filename, n);
    if (n > 1) {
      const dot = f.filename.lastIndexOf(".");
      f.filename = dot > 0 ? `${f.filename.slice(0, dot)} (${n})${f.filename.slice(dot)}` : `${f.filename} (${n})`;
    }
  }
  return { files, skippedNames };
}

// ─── Envío ───

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function processRow(supabase: any, row: any): Promise<Record<string, unknown>> {
  const finish = async (changes: Record<string, unknown>) => {
    await supabase.from("broker_email_queue").update(changes).eq("id", row.id);
    return { id: row.id, ...changes };
  };

  const ageH = (Date.now() - Date.parse(row.created_at)) / 3600_000;
  if (ageH > (row.kind === "arrival" ? ARRIVAL_MAX_AGE_H : DOCS_MAX_AGE_H)) {
    return await finish({ status: "skipped", error: "Venció sin enviarse (no había hilo de Gmail enlazado a tiempo)" });
  }
  if (!(await isEnabled(supabase, row.tenant_id, TOGGLES[row.kind]))) {
    return await finish({ status: "skipped", error: "Aviso apagado" });
  }

  const { data: load } = await supabase
    .from("loads").select("id, tenant_id, reference_number, status, driver_id, truck_id").eq("id", row.load_id).maybeSingle();
  if (!load || load.status === "cancelled") return await finish({ status: "skipped", error: "Carga cancelada o borrada" });

  const accounts = gmailAccounts();
  if (accounts.length === 0) return await finish({ status: "failed", error: "Falta configurar la cuenta de Gmail (GMAIL_USER)" });

  // Reservar la fila para que dos ejecuciones simultáneas no manden el email dos veces
  // Una fila en "sending" es un intento que se cortó (ej. la función se quedó sin memoria)
  const attemptsNow = row.status === "sending" ? (row.attempts ?? 0) + 1 : (row.attempts ?? 0);
  if (attemptsNow >= 3) {
    return await finish({ status: "failed", attempts: attemptsNow, error: "El envío falló 3 veces (archivos demasiado pesados)" });
  }
  const { data: claimed } = await supabase
    .from("broker_email_queue")
    .update({ status: "sending", attempts: attemptsNow, send_after: minutesFromNow(15) })
    .eq("id", row.id).in("status", ["pending", "waiting_thread", "sending"]).lte("send_after", new Date().toISOString())
    .select("id");
  if (!claimed || claimed.length === 0) return { id: row.id, skipped: "claimed by another run" };

  const step = async (name: string) => {
    const mb = Math.round((Deno.memoryUsage().rss ?? 0) / 1048576);
    await supabase.from("broker_email_queue").update({ error: `en curso: ${name} (${mb} MB)` }).eq("id", row.id);
  };

  try {
    await step("buscando el hilo de Gmail");
    const thread = await ensureThread(supabase, load, accounts);
    if (thread.status !== "linked") {
      await notifyThreadNeeded(supabase, load, thread);
      return await finish({
        status: "waiting_thread",
        send_after: minutesFromNow(RESEARCH_EVERY_MIN),
        error: thread.status === "ambiguous" ? "Varios hilos posibles: elige el correcto" : "No se encontró el hilo de Gmail",
      });
    }
    const account = accounts.find((a) => a.user === String(thread.account).toLowerCase());
    if (!account) return await finish({ status: "failed", error: `La cuenta ${thread.account} ya no está configurada` });

    const [{ data: driver }, { data: truck }] = await Promise.all([
      load.driver_id ? supabase.from("drivers").select("name").eq("id", load.driver_id).maybeSingle() : Promise.resolve({ data: null }),
      load.truck_id ? supabase.from("trucks").select("unit_number").eq("id", load.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const isUpdate = isUpdateRow(row);
    const templateKey = `email_${row.kind}${isUpdate ? "_update" : ""}_${row.stop_type === "pickup" ? "pickup" : "delivery"}`;
    const body = await renderMessage(supabase, load.tenant_id, templateKey, {
      carga: load.reference_number,
      ciudad: row.city,
      driver: driver?.name ?? "",
      unidad: truck?.unit_number ?? "",
      hora: new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }),
    });

    let attachments: Attachment[] = [];
    let skippedNames: string[] = [];
    if (row.kind === "docs") {
      await step("preparando los adjuntos");
      const since = isUpdate ? await lastDocsSentAt(supabase, row) : null;
      ({ files: attachments, skippedNames } = await stopAttachments(supabase, row, load.reference_number, since));
      if (attachments.length === 0) {
        return await finish({ status: "skipped", error: isUpdate ? "No llegó ningún BOL/POD nuevo desde el último envío" : "La parada ya no tiene archivos" });
      }
    }

    await step("leyendo el hilo para responder");
    const target = await replyTarget(account, thread.thread_id, accounts.map((a) => a.user));
    await step(`armando el email (${attachments.length} adjuntos, ${Math.round(attachments.reduce((n, a) => n + a.content.length, 0) / 1024)} KB)`);

    await sendMail(account, {
      to: target.to,
      cc: target.cc,
      subject: target.subject,
      inReplyTo: target.inReplyTo || undefined,
      references: target.references || undefined,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });

    return await finish({
      status: "sent",
      sent_at: new Date().toISOString(),
      body,
      recipients: [...target.to, ...target.cc.map((c) => `cc: ${c}`)].join(", "),
      attachments: attachments.map((a) => a.filename).join(", ") || null,
      error: skippedNames.length > 0 ? `No se adjuntaron (tamaño o error): ${skippedNames.join(", ")}` : null,
    });
  } catch (e) {
    const attempts = attemptsNow + 1;
    return await finish({
      status: attempts >= 3 ? "failed" : "pending",
      attempts,
      send_after: minutesFromNow(10),
      error: errMsg(e).slice(0, 500),
    });
  }
}

async function processDue(supabase: any, loadId?: string) {
  // Pocas filas por corrida: cada una busca en Gmail, analiza fotos y arma adjuntos.
  // Lo que quede sale en la siguiente pasada del cron (cada 2 minutos).
  let q = supabase
    .from("broker_email_queue").select("*")
    .in("status", ["pending", "waiting_thread", "sending"])
    .lte("send_after", new Date().toISOString())
    .order("created_at").limit(4);
  if (loadId) q = q.eq("load_id", loadId);
  const { data: rows } = await q;
  const started = Date.now();
  const results = [];
  for (const row of (rows as any[]) || []) {
    if (results.length > 0 && Date.now() - started > 45_000) {
      results.push({ id: row.id, skipped: "queda para la próxima pasada" });
      break;
    }
    try {
      results.push(await processRow(supabase, row));
    } catch (e) {
      results.push({ id: row.id, error: errMsg(e) });
    }
  }
  return results;
}

// ─── Acciones del TMS ───

async function userLoad(req: Request, supabase: any, loadId: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: load } = await supabase.from("loads").select("id, tenant_id, reference_number").eq("id", loadId).maybeSingle();
  if (!load) throw new Error("Carga no encontrada");
  const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
  if (tenantId !== load.tenant_id) {
    const { data: isMaster } = await supabase.rpc("is_master_admin", { _user_id: user.id });
    if (!isMaster) throw new Error("Unauthorized");
  }
  return load;
}

async function handleUserAction(req: Request, supabase: any, body: any) {
  const { action, load_id } = body;
  if (!load_id) return json({ error: "Falta load_id" }, 400);
  const load = await userLoad(req, supabase, load_id);
  const accounts = gmailAccounts();
  if (accounts.length === 0) return json({ error: "Falta configurar la cuenta de Gmail" }, 400);

  if (action === "search") {
    const text = String(body.query ?? "").trim();
    const errors: string[] = [];
    const candidates = text
      ? await searchThreads(accounts, /newer_than:|after:/.test(text) ? text : `${text} newer_than:120d`, errors)
      : await findLoadThreads(accounts, load.reference_number, errors);
    return json({ candidates, accounts: accounts.map((a) => a.user), errors });
  }

  if (action === "link") {
    const account = accounts.find((a) => a.user === String(body.account ?? "").toLowerCase());
    if (!account || !body.thread_id) return json({ error: "Hilo inválido" }, 400);
    await supabase.from("load_email_threads").upsert({
      load_id: load.id,
      tenant_id: load.tenant_id,
      status: "linked",
      link_mode: "manual",
      account: account.user,
      thread_id: String(body.thread_id),
      subject: body.subject ?? null,
      candidates: [],
      searched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "load_id" });
    // Mandar lo que estaba esperando por el hilo
    await supabase.from("broker_email_queue")
      .update({ send_after: new Date().toISOString() })
      .eq("load_id", load.id).eq("status", "waiting_thread");
    return json({ linked: true, sent: await processDue(supabase, load.id) });
  }

  if (action === "send_now") {
    await supabase.from("broker_email_queue")
      .update({ status: "pending", attempts: 0, send_after: new Date().toISOString() })
      .eq("id", body.id).eq("load_id", load.id).in("status", ["pending", "waiting_thread"]);
    return json({ sent: await processDue(supabase, load.id) });
  }

  if (action === "retry") {
    await supabase.from("broker_email_queue")
      .update({ status: "pending", attempts: 0, send_after: new Date().toISOString(), created_at: new Date().toISOString() })
      .eq("id", body.id).eq("load_id", load.id).in("status", ["failed", "skipped"]);
    return json({ sent: await processDue(supabase, load.id) });
  }

  return json({ error: "Acción desconocida" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();

    if (body.action) return await handleUserAction(req, supabase, body);

    const secret = Deno.env.get("CRON_SECRET");
    if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

    if (body.event === "arrival" || body.event === "docs") {
      if (!body.stop_id) return json({ error: "Bad request" }, 400);
      return json(await enqueue(supabase, body.event, body.stop_id));
    }
    if (body.event === "process") return json({ results: await processDue(supabase) });
    if (body.event === "queue") {
      let q = supabase
        .from("broker_email_queue")
        .select("id, load_id, kind, stop_type, stop_order, status, attempts, send_after, error, sent_at, created_at, message_key, loads(reference_number)")
        .order("created_at", { ascending: false }).limit(body.limit ?? 15);
      if (body.ref) {
        const { data: l } = await supabase.from("loads").select("id").eq("reference_number", body.ref).maybeSingle();
        if (!l) return json({ rows: [], note: "carga no encontrada" });
        q = q.eq("load_id", l.id);
      }
      const { data } = await q;
      return json({ rows: data ?? [] });
    }
    if (body.event === "load_state" && body.ref) {
      const { data: load } = await supabase
        .from("loads").select("id, reference_number, status, tenant_id").eq("reference_number", body.ref).maybeSingle();
      if (!load) return json({ error: "carga no encontrada" }, 404);
      const { data: stops } = await supabase
        .from("load_stops").select("id, stop_type, stop_order, arrived_at").eq("load_id", load.id).order("stop_order");
      const { data: docs } = await supabase
        .from("pod_documents").select("id, stop_id, file_name, file_type, is_document, created_at").eq("load_id", load.id).order("created_at");
      const { data: thread } = await supabase.from("load_email_threads").select("*").eq("load_id", load.id).maybeSingle();
      const { data: rows } = await supabase.from("broker_email_queue").select("*").eq("load_id", load.id);
      const { data: tenant } = await supabase
        .from("tenants").select("email_broker_arrival, email_broker_docs").eq("id", load.tenant_id).maybeSingle();
      return json({ load, stops, docs, thread, queue: rows, toggles: tenant });
    }
    if (body.event === "files" && body.id) {
      const { data: row } = await supabase.from("broker_email_queue").select("*").eq("id", body.id).maybeSingle();
      if (!row) return json({ error: "row not found" }, 404);
      const docs = await stopDocuments(supabase, row);
      const out = [];
      for (const d of docs) {
        const folder = String(d.file_url).split("/").slice(0, -1).join("/");
        const base = String(d.file_url).split("/").pop();
        const { data: objs } = await supabase.storage.from("driver-documents").list(folder, { limit: 1000 });
        const match = ((objs as any[]) || []).find((o) => o.name === base);
        out.push({
          name: d.file_name, type: d.file_type, is_document: d.is_document,
          kb: match?.metadata?.size ? Math.round(match.metadata.size / 1024) : null,
          created_at: d.created_at,
        });
      }
      return json({ files: out });
    }
    if (body.event === "run_row" && body.id) {
      const { data: row } = await supabase.from("broker_email_queue").select("*").eq("id", body.id).maybeSingle();
      if (!row) return json({ error: "row not found" }, 404);
      await supabase.from("broker_email_queue")
        .update({ status: "pending", send_after: new Date().toISOString() }).eq("id", body.id);
      return json({ result: await processRow(supabase, { ...row, status: "pending", send_after: new Date().toISOString() }) });
    }
    return json({ error: "Bad request" }, 400);
  } catch (e) {
    console.error("broker-email error:", e);
    const message = errMsg(e);
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});

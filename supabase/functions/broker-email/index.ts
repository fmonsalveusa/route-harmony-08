// deno-lint-ignore-file no-explicit-any
// Emails automáticos al broker, como respuesta dentro del hilo de Gmail de la carga.
//  • arrival: el driver llegó a una parada (GPS o manual) → "llegó y espera"
//  • docs: se subieron fotos/BOL/POD a una parada → email con los archivos adjuntos
//  • process: cron cada 5 min (docs pendientes y reintentos)
//  • search / link / retry: acciones desde el TMS (usuario autenticado)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { cityState } from "../_shared/loadHelpers.ts";
import { isEnabled, renderMessage } from "../_shared/messaging.ts";
import { findLoadThreads, gmailAccounts, replyTarget, searchThreads, type GmailAccount } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DOCS_DELAY_MIN = 10;        // espera para juntar todas las fotos de la parada
const ARRIVAL_MAX_AGE_H = 3;      // "llegó y espera" ya no sirve después
const DOCS_MAX_AGE_H = 72;
const RESEARCH_EVERY_MIN = 30;    // volver a buscar el hilo si no estaba
const MAX_ATTACH_BYTES = 20 * 1024 * 1024;
const TOGGLES: Record<string, string> = { arrival: "email_broker_arrival", docs: "email_broker_docs" };

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
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
    // Llegan más archivos de la misma parada: esperar un poco más para mandarlos juntos
    if (kind === "docs" && existing.status === "pending") {
      await supabase.from("broker_email_queue").update({ send_after: minutesFromNow(DOCS_DELAY_MIN) }).eq("id", existing.id);
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
    send_after: kind === "docs" ? minutesFromNow(DOCS_DELAY_MIN) : new Date().toISOString(),
  }).select("*").single();
  if (error) return { skipped: "already queued" };

  if (kind === "arrival") return await processRow(supabase, row);
  return { queued: row.id };
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

async function stopAttachments(supabase: any, row: any) {
  const { data: stops } = await supabase
    .from("load_stops").select("id").eq("load_id", row.load_id).eq("stop_type", row.stop_type).eq("stop_order", row.stop_order);
  const stopIds = ((stops as any[]) || []).map((s) => s.id);
  if (stopIds.length === 0) return { files: [], skippedNames: [] as string[] };

  const { data: docs } = await supabase
    .from("pod_documents").select("file_url, file_name, file_type, created_at").in("stop_id", stopIds).order("created_at");

  // PDFs primero (BOL/POD), luego fotos
  const sorted = ((docs as any[]) || []).sort((a, b) => Number(a.file_type === "image") - Number(b.file_type === "image"));
  const files: { filename: string; content: Uint8Array; encoding: "binary"; contentType: string }[] = [];
  const skippedNames: string[] = [];
  let total = 0;
  for (const d of sorted) {
    if (!d.file_url) continue;
    const bytes = await downloadStorageFile(supabase, d.file_url);
    const name = d.file_name || `file_${files.length + 1}`;
    if (!bytes) { skippedNames.push(name); continue; }
    if (total + bytes.length > MAX_ATTACH_BYTES) { skippedNames.push(name); continue; }
    total += bytes.length;
    files.push({ filename: name, content: bytes, encoding: "binary", contentType: contentTypeOf(name, d.file_type) });
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
  const { data: claimed } = await supabase
    .from("broker_email_queue")
    .update({ status: "sending", send_after: minutesFromNow(15) })
    .eq("id", row.id).in("status", ["pending", "waiting_thread", "sending"]).lte("send_after", new Date().toISOString())
    .select("id");
  if (!claimed || claimed.length === 0) return { id: row.id, skipped: "claimed by another run" };

  try {
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

    const templateKey = `email_${row.kind}_${row.stop_type === "pickup" ? "pickup" : "delivery"}`;
    const body = await renderMessage(supabase, load.tenant_id, templateKey, {
      carga: load.reference_number,
      ciudad: row.city,
      driver: driver?.name ?? "",
      unidad: truck?.unit_number ?? "",
      hora: new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }),
    });

    let attachments: Awaited<ReturnType<typeof stopAttachments>>["files"] = [];
    let skippedNames: string[] = [];
    if (row.kind === "docs") {
      ({ files: attachments, skippedNames } = await stopAttachments(supabase, row));
      if (attachments.length === 0) return await finish({ status: "skipped", error: "La parada ya no tiene archivos" });
    }

    const target = await replyTarget(account, thread.thread_id, accounts.map((a) => a.user));

    const smtp = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: account.user, password: account.pass } },
    });
    try {
      await smtp.send({
        from: account.user,
        to: target.to,
        cc: target.cc.length > 0 ? target.cc : undefined,
        subject: target.subject,
        inReplyTo: target.inReplyTo || undefined,
        references: target.references || undefined,
        content: body,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`,
        attachments,
      });
    } finally {
      await smtp.close();
    }

    return await finish({
      status: "sent",
      sent_at: new Date().toISOString(),
      body,
      recipients: [...target.to, ...target.cc.map((c) => `cc: ${c}`)].join(", "),
      attachments: attachments.map((a) => a.filename).join(", ") || null,
      error: skippedNames.length > 0 ? `No se adjuntaron (tamaño o error): ${skippedNames.join(", ")}` : null,
    });
  } catch (e) {
    const attempts = (row.attempts ?? 0) + 1;
    return await finish({
      status: attempts >= 3 ? "failed" : "pending",
      attempts,
      send_after: minutesFromNow(10),
      error: errMsg(e).slice(0, 500),
    });
  }
}

async function processDue(supabase: any, loadId?: string) {
  let q = supabase
    .from("broker_email_queue").select("*")
    .in("status", ["pending", "waiting_thread", "sending"])
    .lte("send_after", new Date().toISOString())
    .order("created_at").limit(20);
  if (loadId) q = q.eq("load_id", loadId);
  const { data: rows } = await q;
  const results = [];
  for (const row of (rows as any[]) || []) {
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
    return json({ error: "Bad request" }, 400);
  } catch (e) {
    console.error("broker-email error:", e);
    const message = errMsg(e);
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});

// deno-lint-ignore-file no-explicit-any
// Bandeja de rate confirmations: revisa el Gmail de las empresas activas, lee con la IA los PDF
// que parecen RC y los deja como borrador para crear la carga desde Loads.
//  • scan (cron cada 5 min)
//  • convert / discard: acciones desde el TMS (usuario del equipo)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import PostalMime from "npm:postal-mime@2.3.2";
import { fetchMessages, gmailAccounts, parseAddresses } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Emails recientes con PDF que no mandamos nosotros
const QUERY = "has:attachment filename:pdf newer_than:2d -from:me";
const PER_ACCOUNT = 4;                 // la IA tarda ~10-20 s por PDF
const MAX_PDF_BYTES = 10 * 1024 * 1024;
// Adjuntos que claramente no son un RC (salvo que digan rate/confirmation/tender)
const NOT_RC = /invoice|factura|\bpod\b|\bbol\b|receipt|statement|w-?9|insurance|\bcoi\b|packet|agreement|lumper|scale/i;
const LOOKS_RC = /rate|confirm|tender|ratecon|\brc\b|load/i;

const norm = (s: string | null | undefined) => String(s ?? "").trim().toUpperCase();

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function extract(pdf: Uint8Array): Promise<any | null> {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": Deno.env.get("CRON_SECRET")!,
      // La puerta de las Edge Functions exige un JWT; adentro se valida el secreto del cron
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    },
    body: JSON.stringify({ pdfBase64: toBase64(pdf) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(data?.error ?? `extract-pdf HTTP ${res.status}`);
  return data.data;
}

async function scanTenant(supabase: any, tenant: any) {
  const { data: companies } = await supabase
    .from("companies").select("email").eq("tenant_id", tenant.id).neq("status", "inactive").not("email", "is", null);
  const emails = new Set(((companies as any[]) || []).map((c) => String(c.email).trim().toLowerCase()));
  const accounts = gmailAccounts().filter((a) => emails.has(a.user));
  if (accounts.length === 0) return { skipped: "ninguna empresa activa tiene su Gmail conectado" };

  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: seen } = await supabase.from("rc_inbox").select("message_id").eq("tenant_id", tenant.id).gte("created_at", since);
  const processed = new Set(((seen as any[]) || []).map((r) => r.message_id));
  const results: unknown[] = [];

  for (const acc of accounts) {
    let messages;
    try {
      messages = await fetchMessages(acc, QUERY, (id) => processed.has(id), PER_ACCOUNT);
    } catch (e) {
      results.push({ account: acc.user, error: errMsg(e) });
      continue;
    }

    for (const m of messages) {
      const from = parseAddresses(m.from)[0]?.email ?? m.from;
      const base = {
        tenant_id: tenant.id, message_id: m.messageId, account: acc.user, thread_id: m.threadId || null,
        subject: m.subject, from_email: from, received_at: Date.parse(m.date) ? new Date(m.date).toISOString() : null,
      };
      const save = (row: Record<string, unknown>) =>
        supabase.from("rc_inbox").upsert({ ...base, ...row, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,message_id" });

      try {
        if (!m.raw) { await save({ status: "not_rc", error: "Email demasiado pesado" }); continue; }
        const email = await PostalMime.parse(m.raw);
        const pdfs = (email.attachments ?? []).filter((a: any) =>
          /pdf/i.test(a.mimeType ?? "") || /\.pdf$/i.test(a.filename ?? ""));
        const candidates = pdfs.filter((a: any) => {
          const name = `${a.filename ?? ""} ${m.subject}`;
          return !NOT_RC.test(a.filename ?? "") || LOOKS_RC.test(name);
        });
        const pick = candidates.find((a: any) => LOOKS_RC.test(a.filename ?? "")) ?? candidates[0];
        if (!pick) { await save({ status: "not_rc", error: "Sin PDF de rate confirmation" }); continue; }

        const bytes = new Uint8Array(pick.content as ArrayBuffer);
        if (bytes.length > MAX_PDF_BYTES) { await save({ status: "not_rc", error: "PDF demasiado pesado" }); continue; }

        const name = String(pick.filename || "rate-confirmation.pdf").replace(/[^\w.\-]+/g, "_");
        const path = `loads/inbox/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage.from("driver-documents").upload(path, bytes, { contentType: "application/pdf" });
        if (upErr) throw upErr;

        const x = await extract(bytes);
        const reference = norm(x?.referenceNumber);
        const rate = Number(x?.totalRate) || null;
        const stops = Array.isArray(x?.stops) ? x.stops : [];
        // Todo RC trae tarifa: sin tarifa es otro documento (factura, BOL, guía aérea, etc.)
        if (!rate) {
          await save({ status: "not_rc", pdf_path: path, pdf_name: name, extracted: x });
          continue;
        }

        const row = {
          pdf_path: path, pdf_name: name, extracted: x, reference_number: reference || null,
          broker: x?.brokerClient || null,
          origin: x?.origin || stops.find((s: any) => s.stop_type === "pickup")?.address || null,
          destination: x?.destination || [...stops].reverse().find((s: any) => s.stop_type === "delivery")?.address || null,
          pickup_date: x?.pickupDate || null, total_rate: rate, error: null,
        };

        // ¿Ya existe la carga? Entonces es un RC repetido o corregido
        if (reference) {
          const { data: loads } = await supabase
            .from("loads").select("id, reference_number, created_at").eq("tenant_id", tenant.id).ilike("reference_number", reference).limit(1);
          const load = (loads as any[])?.[0];
          if (load) {
            await save({ ...row, status: "existing_load", load_id: load.id });
            // Solo se avisa si el RC llegó después de crear la carga (corregido o reenviado por el broker)
            const receivedAt = base.received_at ? Date.parse(base.received_at) : Date.now();
            if (receivedAt > Date.parse(load.created_at) + 10 * 60_000) await supabase.from("notifications").insert({
              tenant_id: tenant.id, type: "rc_inbox", load_id: load.id,
              title: `RC recibido de nuevo - #${load.reference_number}`,
              message: `Llegó otro rate confirmation para la carga #${load.reference_number}${x?.brokerClient ? ` (${x.brokerClient})` : ""}. Si cambió la tarifa o una cita, revísalo en Loads → Rate confirmations recibidos.`,
            });
            results.push({ reference, status: "existing_load" });
            continue;
          }
          // Un borrador anterior con la misma referencia queda reemplazado por el más nuevo
          await supabase.from("rc_inbox").update({ status: "discarded", error: "Reemplazado por un RC más nuevo", updated_at: new Date().toISOString() })
            .eq("tenant_id", tenant.id).eq("status", "pending").eq("reference_number", reference).neq("message_id", m.messageId);
        }

        await save({ ...row, status: "pending" });
        results.push({ reference, status: "pending" });
      } catch (e) {
        await save({ status: "error", error: errMsg(e).slice(0, 400) });
        results.push({ message: m.subject, error: errMsg(e) });
      }
    }
  }
  return { results };
}

/** Acciones del TMS: convertir (enlaza el hilo de Gmail a la carga) o descartar */
async function userAction(req: Request, supabase: any, body: any) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!((roles as any[]) || []).some((r) => ["admin", "accounting", "dispatcher", "master_admin"].includes(r.role))) {
    return json({ error: "Unauthorized" }, 403);
  }
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  const { data: item } = await supabase.from("rc_inbox").select("*").eq("id", body.id).maybeSingle();
  if (!item || item.tenant_id !== profile?.tenant_id) return json({ error: "No encontrado" }, 404);

  if (body.action === "discard") {
    await supabase.from("rc_inbox").update({ status: "discarded", updated_at: new Date().toISOString() }).eq("id", item.id);
    return json({ discarded: true });
  }

  if (body.action === "convert") {
    const { data: load } = await supabase.from("loads").select("id, tenant_id").eq("id", body.load_id).maybeSingle();
    if (!load || load.tenant_id !== item.tenant_id) return json({ error: "Carga no encontrada" }, 404);
    await supabase.from("rc_inbox").update({ status: "converted", load_id: load.id, updated_at: new Date().toISOString() }).eq("id", item.id);
    // El hilo del email queda enlazado a la carga (los emails al broker salen ahí)
    let linked = false;
    if (item.thread_id) {
      const { data: existing } = await supabase.from("load_email_threads").select("status").eq("load_id", load.id).maybeSingle();
      if (existing?.status !== "linked") {
        await supabase.from("load_email_threads").upsert({
          load_id: load.id, tenant_id: load.tenant_id, status: "linked", link_mode: "auto",
          account: item.account, thread_id: item.thread_id, subject: item.subject, candidates: [], labels: [],
          searched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: "load_id" });
        linked = true;
      }
    }
    return json({ converted: true, thread_linked: linked });
  }
  return json({ error: "Acción desconocida" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action) return await userAction(req, supabase, body);

    const secret = Deno.env.get("CRON_SECRET");
    if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

    const { data: tenants } = await supabase.from("tenants").select("*");
    const out: Record<string, unknown> = {};
    for (const t of (tenants as any[]) || []) {
      if (t.rc_inbox_enabled === false) continue;
      out[t.id] = await scanTenant(supabase, t);
    }
    console.log("rc-inbox:", JSON.stringify(out));
    return json(out);
  } catch (e) {
    console.error("rc-inbox error:", e);
    return json({ error: errMsg(e) }, 500);
  }
});

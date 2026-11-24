// Documentos firmados de un driver / owner operator (leasing, W9, service agreement):
// juntarlos y enviárselos por email (adjuntos) o al grupo de WhatsApp (solo grupos).
import { sendMail, type MailAttachment } from "./smtp.ts";
import { appGmail } from "./gmail.ts";
import { sendDocumentLogged } from "./messaging.ts";

export interface SignedDoc {
  key: string;
  label: string;
  path: string;
}

const BUCKET = "driver-documents";

/** Ruta del bucket a partir de lo guardado (ruta simple o URL firmada vieja) */
export function storagePath(stored: string): string {
  let p = stored;
  if (p.includes(`/object/sign/${BUCKET}/`)) p = p.split(`/object/sign/${BUCKET}/`)[1].split("?")[0];
  else if (p.includes(`/object/public/${BUCKET}/`)) p = p.split(`/object/public/${BUCKET}/`)[1].split("?")[0];
  try { p = decodeURIComponent(p); } catch { /* ya decodificada */ }
  return p;
}

/** Documentos firmados de un driver (o del investor/OO dueño del camión) */
export async function collectSignedDocs(sb: any, kind: "driver" | "investor", id: string): Promise<SignedDoc[]> {
  const docs: SignedDoc[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, stored: string | null | undefined) => {
    if (!stored) return;
    const path = storagePath(stored);
    if (seen.has(path)) return;
    seen.add(path);
    docs.push({ key, label, path });
  };

  if (kind === "driver") {
    const { data: d } = await sb.from("drivers")
      .select("leasing_agreement_url, leasing_agreement_58_url, leasing_agreement_venco_url, form_w9_url, service_agreement_url")
      .eq("id", id).maybeSingle();
    if (!d) return docs;
    add("leasing_agreement_58_url", "Leasing Agreement - 58 Logistics", d.leasing_agreement_58_url);
    add("leasing_agreement_url", "Leasing Agreement - AG-AR", d.leasing_agreement_url);
    add("leasing_agreement_venco_url", "Leasing Agreement - VENCO", d.leasing_agreement_venco_url);
    const { data: extra } = await sb.from("driver_leasing_agreements").select("id, company_name, file_url").eq("driver_id", id);
    for (const l of (extra as any[]) || []) add(`leasing:${l.id}`, `Leasing Agreement - ${l.company_name}`, l.file_url);
    add("form_w9_url", "Form W9", d.form_w9_url);
    add("service_agreement_url", "Service Agreement", d.service_agreement_url);
  } else {
    const { data: inv } = await sb.from("investors")
      .select("leasing_agreement_url, w9_url, service_agreement_url").eq("id", id).maybeSingle();
    if (!inv) return docs;
    add("leasing_agreement_url", "Leasing Agreement", inv.leasing_agreement_url);
    add("w9_url", "Form W9", inv.w9_url);
    add("service_agreement_url", "Service Agreement", inv.service_agreement_url);
  }
  return docs;
}

const ext = (path: string) => (path.split(".").pop() || "pdf").toLowerCase();
const fileName = (doc: SignedDoc, person: string) => `${doc.label} - ${person}.${ext(doc.path)}`.replace(/[\\/:*?"<>|]/g, "");
const mimeOf = (path: string) => {
  const e = ext(path);
  return e === "pdf" ? "application/pdf" : e === "png" ? "image/png" : ["jpg", "jpeg"].includes(e) ? "image/jpeg" : "application/octet-stream";
};

/** Email al driver con sus documentos firmados adjuntos (inglés + español) */
export async function emailSignedDocs(sb: any, to: string, person: string, docs: SignedDoc[]) {
  if (!to || !/@/.test(to) || to.endsWith("@onboarding.local")) throw new Error("El driver no tiene email válido");
  if (docs.length === 0) throw new Error("No hay documentos para enviar");
  const attachments: MailAttachment[] = [];
  for (const doc of docs) {
    const { data, error } = await sb.storage.from(BUCKET).download(doc.path);
    if (error || !data) throw new Error(`No se encontró el archivo: ${doc.label}`);
    attachments.push({ filename: fileName(doc, person), content: new Uint8Array(await data.arrayBuffer()), contentType: mimeOf(doc.path) });
  }
  const first = (person || "").trim().split(/\s+/)[0] || "";
  const list = docs.map((d) => `- ${d.label}`).join("\n");
  const text =
    `Hi ${first},\n\nThank you for completing your onboarding with 58 Logistics. Attached are copies of your signed documents for your records:\n\n${list}\n\nIf you have any questions, just reply to this email.\n\n` +
    `— — —\n\nHola ${first},\n\nGracias por completar tu registro con 58 Logistics. Adjuntamos copia de tus documentos firmados para que los guardes:\n\n${list}\n\nSi tienes alguna pregunta, responde a este email.\n\n58 Logistics LLC`;
  const acc = appGmail();
  if (!acc.user || !acc.pass) throw new Error("Falta configurar el Gmail de la app");
  await sendMail({ user: acc.user, pass: acc.pass }, {
    fromName: "58 Logistics LLC",
    to: [to],
    subject: "Your signed documents / Tus documentos firmados – 58 Logistics",
    text,
    attachments,
  });
}

/** Cada documento al grupo de WhatsApp del driver (solo grupos @g.us) */
export async function whatsappSignedDocs(sb: any, tenantId: string | null, groupId: string, groupName: string | null, person: string, docs: SignedDoc[], caption: string) {
  if (!groupId || !groupId.endsWith("@g.us")) throw new Error("El driver no tiene grupo de WhatsApp");
  if (docs.length === 0) throw new Error("No hay documentos para enviar");
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(doc.path, 3600);
    if (error || !data?.signedUrl) throw new Error(`No se encontró el archivo: ${doc.label}`);
    await sendDocumentLogged(sb, {
      tenantId, templateKey: "driver_docs", recipientType: "driver", recipientName: person,
      groupId, message: i === 0 ? caption : doc.label, reference: doc.label,
    }, data.signedUrl, fileName(doc, person));
    if (i < docs.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  void groupName;
}

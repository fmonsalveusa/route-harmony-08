import { supabase } from "@/integrations/supabase/client";
import { generateSignedPdf } from "@/lib/generateSignedPdf";
import { SignDocument } from "@/types/document";
import { documentPdfPath, isStoragePath, removePdfs, resolvePdf, uploadPdf } from "@/lib/signingStorage";

function rowToDoc(row: any): SignDocument {
  return {
    id: row.id,
    fileName: row.file_name,
    fileData: row.file_data,
    signedFileData: row.signed_file_data ?? undefined,
    status: row.status === "pending" && row.expires_at < Date.now() ? "expired" : row.status,
    createdAt: row.created_at,
    signedAt: row.signed_at ?? undefined,
    expiresAt: row.expires_at,
    fields: (row.fields as any[]) ?? [],
    signerData: row.signer_data as any,
    recipientEmail: row.recipient_email ?? undefined,
    signerName: row.signer_name ?? undefined,
  };
}

/**
 * Los PDFs viven en el Storage; en la base solo queda su ruta.
 * Aquí se bajan para que las pantallas los reciban como siempre (data URL).
 */
async function loadPdfs(doc: SignDocument): Promise<SignDocument> {
  const [fileData, signedFileData] = await Promise.all([
    resolvePdf(doc.fileData),
    resolvePdf(doc.signedFileData),
  ]);
  return { ...doc, fileData: fileData ?? "", signedFileData };
}

async function hydrateSignedPdf(doc: SignDocument): Promise<SignDocument> {
  const hasFilledFields = doc.fields.some((field) => !!field.value);
  if (doc.status !== "signed" || doc.signedFileData || !hasFilledFields) {
    return doc;
  }
  if (!doc.fileData) return doc;

  try {
    const signedFileData = await generateSignedPdf(doc.fileData, doc.fields);
    const path = await uploadPdf(documentPdfPath(doc.id, "signed"), signedFileData);

    const { error } = await supabase
      .from("documents" as any)
      .update({ signed_file_data: path } as any)
      .eq("id", doc.id);

    if (error) {
      console.error("Failed to persist regenerated signed PDF:", error);
      return doc;
    }

    return {
      ...doc,
      signedFileData,
    };
  } catch (error) {
    console.error("Failed to regenerate signed PDF:", error);
    return doc;
  }
}

export async function getDocuments(): Promise<SignDocument[]> {
  const { data, error } = await supabase
    .from("documents" as any)
    .select("id, file_name, status, created_at, signed_at, expires_at, fields, signer_data, recipient_email, signer_name")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  // La lista no necesita los PDFs: se bajan al abrir cada documento
  return (data ?? []).map((row) => rowToDoc(row));
}

export async function getDocument(id: string): Promise<SignDocument | undefined> {
  const { data, error } = await supabase
    .from("documents" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return hydrateSignedPdf(await loadPdfs(rowToDoc(data)));
}

export async function saveDocument(doc: SignDocument): Promise<void> {
  // Si vienen como data URL, se suben al Storage y en la base queda la ruta
  const filePath = doc.fileData && !isStoragePath(doc.fileData)
    ? await uploadPdf(documentPdfPath(doc.id, "original"), doc.fileData)
    : doc.fileData;
  const signedPath = doc.signedFileData && !isStoragePath(doc.signedFileData)
    ? await uploadPdf(documentPdfPath(doc.id, "signed"), doc.signedFileData)
    : doc.signedFileData;

  const { error } = await supabase
    .from("documents" as any)
    .upsert({
      id: doc.id,
      file_name: doc.fileName,
      file_data: filePath,
      signed_file_data: signedPath ?? null,
      status: doc.status,
      created_at: doc.createdAt,
      signed_at: doc.signedAt ?? null,
      expires_at: doc.expiresAt,
      fields: doc.fields as any,
      signer_data: doc.signerData as any ?? null,
      recipient_email: doc.recipientEmail ?? null,
      signer_name: doc.signerName ?? null,
    } as any);
  if (error) { console.error(error); throw error; }
}

export async function deleteDocument(id: string): Promise<void> {
  const { data } = await supabase
    .from("documents" as any)
    .select("file_data, signed_file_data")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("documents" as any)
    .delete()
    .eq("id", id);
  if (error) { console.error(error); throw error; }

  await removePdfs([(data as any)?.file_data, (data as any)?.signed_file_data]);
}

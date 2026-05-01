import { supabase } from "@/integrations/supabase/client";
import { generateSignedPdf } from "@/lib/generateSignedPdf";
import { SignDocument } from "@/types/document";

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
    signerName: row.signer_name ?? undefined, // ← agregar esta línea
  };
}

async function hydrateSignedPdf(doc: SignDocument): Promise<SignDocument> {
  const hasFilledFields = doc.fields.some((field) => !!field.value);

  if (doc.status !== "signed" || doc.signedFileData || !hasFilledFields) {
    return doc;
  }

  try {
    const signedFileData = await generateSignedPdf(doc.fileData, doc.fields);

    const { error } = await supabase
      .from("documents" as any)
      .update({ signed_file_data: signedFileData } as any)
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
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return Promise.all((data ?? []).map((row) => hydrateSignedPdf(rowToDoc(row))));
}

export async function getDocument(id: string): Promise<SignDocument | undefined> {
  const { data, error } = await supabase
    .from("documents" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return hydrateSignedPdf(rowToDoc(data));
}

export async function saveDocument(doc: SignDocument): Promise<void> {
  const { error } = await supabase
    .from("documents" as any)
    .upsert({
      id: doc.id,
      file_name: doc.fileName,
      file_data: doc.fileData,
      signed_file_data: doc.signedFileData ?? null,
      status: doc.status,
      created_at: doc.createdAt,
      signed_at: doc.signedAt ?? null,
      expires_at: doc.expiresAt,
      fields: doc.fields as any,
      signer_data: doc.signerData as any ?? null,
      recipient_email: doc.recipientEmail ?? null,
    } as any);
  if (error) { console.error(error); throw error; }
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from("documents" as any)
    .delete()
    .eq("id", id);
  if (error) { console.error(error); throw error; }
}

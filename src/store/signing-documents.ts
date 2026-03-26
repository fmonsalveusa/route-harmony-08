import { signingSupabase } from '@/integrations/signing/client';
import type { SignDocument } from '@/types/document';

const TABLE = 'documents';

const mapRow = (row: any): SignDocument => ({
  id: row.id,
  fileName: row.file_name,
  fileData: row.file_data,
  signedFileData: row.signed_file_data ?? undefined,
  status: row.status,
  createdAt: new Date(row.created_at).getTime(),
  signedAt: row.signed_at ? new Date(row.signed_at).getTime() : undefined,
  expiresAt: new Date(row.expires_at).getTime(),
  fields: row.fields ?? [],
  signerData: row.signer_data ?? undefined,
  recipientEmail: row.recipient_email ?? undefined,
});

export async function getDocuments(): Promise<SignDocument[]> {
  const { data, error } = await signingSupabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getDocument(id: string): Promise<SignDocument | null> {
  const { data, error } = await signingSupabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function saveDocument(doc: SignDocument): Promise<void> {
  const payload = {
    id: doc.id,
    file_name: doc.fileName,
    file_data: doc.fileData,
    signed_file_data: doc.signedFileData ?? null,
    status: doc.status,
    created_at: new Date(doc.createdAt).toISOString(),
    signed_at: doc.signedAt ? new Date(doc.signedAt).toISOString() : null,
    expires_at: new Date(doc.expiresAt).toISOString(),
    fields: doc.fields,
    signer_data: doc.signerData ?? null,
    recipient_email: doc.recipientEmail ?? null,
  };
  const { error } = await signingSupabase
    .from(TABLE)
    .upsert(payload as any);
  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await signingSupabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

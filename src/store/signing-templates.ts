import { signingSupabase } from '@/integrations/signing/client';
import type { SignTemplate } from '@/types/document';

const TABLE = 'templates';

const mapRow = (row: any): SignTemplate => ({
  id: row.id,
  name: row.name,
  fileName: row.file_name,
  fileData: row.file_data,
  fields: row.fields ?? [],
  createdAt: new Date(row.created_at).getTime(),
});

export async function getTemplates(): Promise<SignTemplate[]> {
  const { data, error } = await signingSupabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getTemplate(id: string): Promise<SignTemplate | null> {
  const { data, error } = await signingSupabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function saveTemplate(tpl: SignTemplate): Promise<void> {
  const payload = {
    id: tpl.id,
    name: tpl.name,
    file_name: tpl.fileName,
    file_data: tpl.fileData,
    fields: tpl.fields,
    created_at: new Date(tpl.createdAt).toISOString(),
  };
  const { error } = await signingSupabase
    .from(TABLE)
    .upsert(payload as any);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await signingSupabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

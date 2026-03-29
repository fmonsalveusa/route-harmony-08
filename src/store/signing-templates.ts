import { supabase } from "@/integrations/supabase/client";
import { SignTemplate, DocumentField } from "@/types/document";

function rowToTemplate(row: any): SignTemplate {
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    fileData: row.file_data,
    fields: (row.fields as DocumentField[]) ?? [],
    createdAt: row.created_at,
  };
}

export async function getTemplates(): Promise<SignTemplate[]> {
  const { data, error } = await supabase
    .from("templates" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<SignTemplate | undefined> {
  const { data, error } = await supabase
    .from("templates" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToTemplate(data);
}

export async function saveTemplate(t: SignTemplate): Promise<void> {
  const { error } = await supabase
    .from("templates" as any)
    .upsert({
      id: t.id,
      name: t.name,
      file_name: t.fileName,
      file_data: t.fileData,
      fields: t.fields as any,
      created_at: t.createdAt,
    } as any);
  if (error) { console.error(error); throw error; }
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("templates" as any)
    .delete()
    .eq("id", id);
  if (error) { console.error(error); throw error; }
}

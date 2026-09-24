import { supabase } from "@/integrations/supabase/client";
import { SignTemplate, DocumentField } from "@/types/document";
import { isStoragePath, removePdfs, resolvePdf, templatePdfPath, uploadPdf } from "@/lib/signingStorage";

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
    .select("id, name, file_name, fields, created_at")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  // El PDF se baja al abrir la plantilla, no para listarlas
  return (data ?? []).map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<SignTemplate | undefined> {
  const { data, error } = await supabase
    .from("templates" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  const tpl = rowToTemplate(data);
  return { ...tpl, fileData: (await resolvePdf(tpl.fileData)) ?? "" };
}

export async function saveTemplate(t: SignTemplate): Promise<void> {
  // El PDF va al Storage; en la base queda solo su ruta
  const filePath = t.fileData && !isStoragePath(t.fileData)
    ? await uploadPdf(templatePdfPath(t.id), t.fileData)
    : t.fileData;

  const { error } = await supabase
    .from("templates" as any)
    .upsert({
      id: t.id,
      name: t.name,
      file_name: t.fileName,
      file_data: filePath,
      fields: t.fields as any,
      created_at: t.createdAt,
    } as any);
  if (error) { console.error(error); throw error; }
}

export async function deleteTemplate(id: string): Promise<void> {
  const { data } = await supabase
    .from("templates" as any).select("file_data").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("templates" as any)
    .delete()
    .eq("id", id);
  if (error) { console.error(error); throw error; }

  await removePdfs([(data as any)?.file_data]);
}

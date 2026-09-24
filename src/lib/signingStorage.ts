import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'driver-documents';

/** Los PDFs viejos están guardados como data URL dentro de la base; los nuevos, como ruta del Storage */
export const isStoragePath = (value?: string | null): boolean =>
  !!value && !value.startsWith('data:');

/** Sube el PDF al Storage y devuelve la ruta que se guarda en la base */
export async function uploadPdf(path: string, dataUrl: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([bytes], { type: 'application/pdf' }), { upsert: true, contentType: 'application/pdf' });
  if (error) throw error;
  return path;
}

/** Baja el PDF del Storage y lo devuelve como data URL, que es lo que esperan el visor y el firmador */
export async function downloadPdf(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error('No se pudo bajar el PDF:', path, error);
    return null;
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
}

/** Valor listo para usar en pantalla: si es una ruta lo baja, si ya es data URL lo deja igual */
export async function resolvePdf(value?: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isStoragePath(value)) return value;
  return (await downloadPdf(value)) ?? undefined;
}

export const documentPdfPath = (id: string, kind: 'original' | 'signed') => `signing/${id}/${kind}.pdf`;
export const templatePdfPath = (id: string) => `signing/templates/${id}.pdf`;

/** Borra los PDFs de un documento o plantilla; no falla si no existen */
export async function removePdfs(paths: (string | null | undefined)[]) {
  const real = paths.filter((p): p is string => isStoragePath(p));
  if (real.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(real);
  } catch (e) {
    console.error('No se pudieron borrar los PDFs:', e);
  }
}

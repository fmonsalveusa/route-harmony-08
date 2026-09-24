const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PDF_ENDPOINT = `${SUPABASE_URL}/functions/v1/signing-pdf`;

/** Los PDFs viejos están guardados como data URL dentro de la base; los nuevos, como ruta del Storage */
export const isStoragePath = (value?: string | null): boolean =>
  !!value && !value.startsWith('data:');

/**
 * Sube el PDF y devuelve la ruta que se guarda en la base.
 * Va por la función porque quien firma no tiene sesión para escribir en el Storage.
 */
export async function uploadPdf(path: string, dataUrl: string): Promise<string> {
  const res = await fetch(PDF_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, data: dataUrl }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || 'No se pudo guardar el PDF');
  }
  return path;
}

/**
 * Baja el PDF y lo devuelve como data URL, que es lo que esperan el visor y el firmador.
 * Va por una función porque el bucket es privado y quien firma no tiene sesión.
 */
export async function downloadPdf(path: string): Promise<string | null> {
  let data: Blob | null = null;
  try {
    const res = await fetch(`${PDF_ENDPOINT}?path=${encodeURIComponent(path)}`);
    if (res.ok) data = await res.blob();
  } catch (e) {
    console.error('No se pudo bajar el PDF:', path, e);
  }
  if (!data) {
    console.error('No se pudo bajar el PDF:', path);
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
  for (const path of paths.filter((p): p is string => isStoragePath(p))) {
    try {
      await fetch(`${PDF_ENDPOINT}?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    } catch (e) {
      console.error('No se pudo borrar el PDF:', path, e);
    }
  }
}

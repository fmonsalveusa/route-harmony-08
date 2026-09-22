import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const isPdfFile = (name: string) => /\.pdf(\?|$)/i.test(name);
const isJpg = (name: string) => /\.jpe?g(\?|$)/i.test(name);
const isPng = (name: string) => /\.png(\?|$)/i.test(name);

const thumbnails = new Map<string, string>();

/** Miniatura de la primera página de un PDF (o la imagen misma si el archivo es una foto) */
export async function documentThumbnail(url: string, fileName: string, width = 220): Promise<string | null> {
  if (!isPdfFile(fileName)) return url;
  const cached = thumbnails.get(url);
  if (cached) return cached;
  try {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    thumbnails.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/** Descarga el documento siempre en PDF: las fotos se convierten a una página */
export async function downloadAsPdf(url: string, fileName: string, saveAs: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let pdfBytes: Uint8Array;
  let name = `${saveAs}.pdf`;

  if (isPdfFile(fileName)) {
    pdfBytes = bytes;
  } else if (isJpg(fileName) || isPng(fileName)) {
    const pdf = await PDFDocument.create();
    const img = isPng(fileName) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    pdfBytes = await pdf.save();
  } else {
    // Formato que no se puede convertir: se descarga tal cual
    pdfBytes = bytes;
    name = `${saveAs}.${fileName.split('.').pop()?.split('?')[0] || 'file'}`;
  }

  const blobUrl = URL.createObjectURL(new Blob([pdfBytes as BlobPart], { type: name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

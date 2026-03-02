import { jsPDF } from 'jspdf';

/**
 * Combines an array of image data URLs into a single PDF blob.
 * Each image becomes a full page, auto-detecting landscape vs portrait.
 */
export async function scanToPdf(imageDataUrls: string[]): Promise<Blob> {
  // We'll create the PDF once we know the first image dimensions
  let pdf: jsPDF | null = null;

  for (let i = 0; i < imageDataUrls.length; i++) {
    const dataUrl = imageDataUrls[i];
    const { width, height } = await getImageDimensions(dataUrl);

    const orientation = width > height ? 'landscape' : 'portrait';
    // Use the image's aspect ratio to size the PDF page (in mm, 72 DPI base)
    const pageWidth = orientation === 'landscape' ? 297 : 210; // A4
    const pageHeight = orientation === 'landscape' ? 210 : 297;

    if (i === 0) {
      pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    } else {
      pdf!.addPage('a4', orientation);
    }

    // Fit image to page maintaining aspect ratio
    const imgAspect = width / height;
    const pageAspect = pageWidth / pageHeight;

    let drawW: number, drawH: number, offsetX: number, offsetY: number;

    if (imgAspect > pageAspect) {
      // Image is wider relative to page
      drawW = pageWidth;
      drawH = pageWidth / imgAspect;
      offsetX = 0;
      offsetY = (pageHeight - drawH) / 2;
    } else {
      // Image is taller relative to page
      drawH = pageHeight;
      drawW = pageHeight * imgAspect;
      offsetX = (pageWidth - drawW) / 2;
      offsetY = 0;
    }

    const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    pdf!.addImage(dataUrl, format, offsetX, offsetY, drawW, drawH);
  }

  if (!pdf) throw new Error('No images provided');

  return pdf.output('blob');
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

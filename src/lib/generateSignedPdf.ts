import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { DocumentField } from '@/types/document';

/**
 * Generates a signed PDF by stamping field values onto the original PDF.
 * Field coordinates (x, y, width, height) are percentages of the page dimensions.
 */
export async function generateSignedPdf(
  originalBase64: string,
  fields: DocumentField[]
): Promise<string> {
  // Extract raw base64
  const raw = originalBase64.includes(',')
    ? originalBase64.split(',')[1]
    : originalBase64;

  const pdfBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (!field.value) continue;

    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageW, height: pageH } = page.getSize();

    // Convert percentage coords to PDF coords
    const x = (field.x / 100) * pageW;
    const w = (field.width / 100) * pageW;
    const h = (field.height / 100) * pageH;
    // PDF y=0 is bottom, field.y is from top
    const y = pageH - (field.y / 100) * pageH - h;

    if (field.type === 'signature' || field.type === 'initials') {
      // field.value is a data URL (image)
      try {
        const imgRaw = field.value.split(',')[1];
        if (!imgRaw) continue;
        let image;
        if (field.value.includes('image/png')) {
          image = await pdfDoc.embedPng(Uint8Array.from(atob(imgRaw), c => c.charCodeAt(0)));
        } else {
          image = await pdfDoc.embedJpg(Uint8Array.from(atob(imgRaw), c => c.charCodeAt(0)));
        }
        // Fit within the field box while preserving aspect ratio
        const imgDims = image.scale(1);
        const scale = Math.min(w / imgDims.width, h / imgDims.height, 1);
        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;
        page.drawImage(image, {
          x: x + (w - drawW) / 2,
          y: y + (h - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      } catch (e) {
        console.warn('Failed to embed signature image', e);
      }
    } else if (field.type === 'checkbox') {
      if (field.value === 'checked') {
        // Draw a checkmark
        const fontSize = Math.min(h * 0.8, 14);
        page.drawText('✓', {
          x: x + 2,
          y: y + (h - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else {
      // Text fields
      let text = field.value;
      if (field.type === 'address') {
        try {
          const parsed = JSON.parse(field.value);
          text = [parsed.street, [parsed.city, parsed.state, parsed.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ');
        } catch {
          // use raw value
        }
      }

      const fontSize = Math.min(h * 0.6, 11);
      // Truncate if text is too wide
      let displayText = text;
      const maxWidth = w - 4;
      while (font.widthOfTextAtSize(displayText, fontSize) > maxWidth && displayText.length > 1) {
        displayText = displayText.slice(0, -1);
      }

      page.drawText(displayText, {
        x: x + 2,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  const signedBytes = await pdfDoc.save();
  // Convert to data URL
  let binary = '';
  for (let i = 0; i < signedBytes.length; i++) {
    binary += String.fromCharCode(signedBytes[i]);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

/**
 * Scanner image utilities using createImageBitmap for Android compatibility.
 * Falls back to new Image() when createImageBitmap is not available.
 */

/** Convert ArrayBuffer to base64 in chunks to avoid call-stack limits on Android */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/** Convert a data URL string to a Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)![1];
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

/** Convert a File to a data-URL using ArrayBuffer (reliable on Android) */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const base64 = arrayBufferToBase64(buffer);
        const mime = file.type || 'image/jpeg';
        resolve(`data:${mime};base64,${base64}`);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Draw an ImageBitmap or HTMLImageElement to a canvas and return data URL.
 * Uses createImageBitmap (preferred on Android) with fallback to new Image().
 */
async function loadAndDraw(
  source: string | Blob,
  targetW?: number,
  targetH?: number,
  processor?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  quality = 0.92
): Promise<string> {
  let w: number, h: number;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Try createImageBitmap first (better Android support for large images)
  if (typeof createImageBitmap === 'function') {
    try {
      let blob: Blob;
      if (typeof source === 'string') {
        blob = dataUrlToBlob(source);
      } else {
        blob = source;
      }
      const bmp = await createImageBitmap(blob);
      w = targetW ?? bmp.width;
      h = targetH ?? bmp.height;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      if (processor) processor(ctx, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    } catch (e) {
      console.warn('createImageBitmap failed, falling back to Image()', e);
    }
  }

  // Fallback: new Image()
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      w = targetW ?? img.width;
      h = targetH ?? img.height;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      if (processor) processor(ctx, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  });
}

/** Enhance image contrast (document scanner style — B&W) */
export async function enhanceImage(dataUrl: string): Promise<string> {
  return loadAndDraw(dataUrl, undefined, undefined, (ctx, w, h) => {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const val = gray > 140 ? 255 : gray < 60 ? 0 : Math.round((gray - 60) * (255 / 80));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
  }, 0.92);
}

/** S-curve function for smooth contrast */
function sCurve(v: number): number {
  // Normalize 0-255 to 0-1, apply sigmoid-like curve, back to 0-255
  const x = v / 255;
  const s = x * x * (3 - 2 * x); // smoothstep
  return Math.round(s * 255);
}

/** Enhance image preserving color — soft contrast + saturation boost */
export async function enhanceImageColor(dataUrl: string): Promise<string> {
  return loadAndDraw(dataUrl, undefined, undefined, (ctx, w, h) => {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const satBoost = 1.1; // +10% saturation

    for (let i = 0; i < data.length; i += 4) {
      // Apply S-curve contrast per channel
      let r = sCurve(data[i]);
      let g = sCurve(data[i + 1]);
      let b = sCurve(data[i + 2]);

      // Boost saturation: move each channel away from luminance
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      r = Math.min(255, Math.max(0, Math.round(lum + (r - lum) * satBoost)));
      g = Math.min(255, Math.max(0, Math.round(lum + (g - lum) * satBoost)));
      b = Math.min(255, Math.max(0, Math.round(lum + (b - lum) * satBoost)));

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  }, 0.95);
}

/** Resize image for AI edge detection (small payload) */
export async function resizeForDetection(dataUrl: string, maxDim = 1024): Promise<string> {
  // Get dimensions first
  const blob = dataUrlToBlob(dataUrl);
  let origW: number, origH: number;

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      origW = bmp.width;
      origH = bmp.height;
      bmp.close();
    } catch {
      return dataUrl; // can't decode, return original
    }
  } else {
    const dims = await getImageDimensions(dataUrl);
    origW = dims.width;
    origH = dims.height;
  }

  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  if (scale >= 1) return dataUrl;

  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);
  return loadAndDraw(dataUrl, w, h, undefined, 0.7);
}

/** Resize large camera images for crop overlay (Android cameras can be 12MP+) */
export async function resizeForCrop(dataUrl: string, maxDim = 3200): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  let origW: number, origH: number;

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      origW = bmp.width;
      origH = bmp.height;
      bmp.close();
    } catch {
      return dataUrl;
    }
  } else {
    const dims = await getImageDimensions(dataUrl);
    origW = dims.width;
    origH = dims.height;
  }

  if (origW <= maxDim && origH <= maxDim) return dataUrl;

  const scale = maxDim / Math.max(origW, origH);
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);
  return loadAndDraw(dataUrl, w, h, undefined, 0.85);
}

/** Helper to get dimensions via new Image() */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1024, height: 1024 });
    img.src = dataUrl;
  });
}

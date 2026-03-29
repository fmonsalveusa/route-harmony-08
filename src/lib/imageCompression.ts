interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.80,
};

/**
 * Compress an image File/Blob by resizing to maxDimension and exporting as JPEG.
 * PDFs and non-image files are returned unchanged.
 */
export function compressImage(
  file: File | Blob,
  options?: CompressOptions
): Promise<Blob> {
  const { maxDimension, quality } = { ...DEFAULT_OPTIONS, ...options };

  // Skip non-image files (e.g. PDFs)
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      const longest = Math.max(width, height);

      if (longest > maxDimension) {
        const scale = maxDimension / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // If we can't decode, return original
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * Compress a data-URL image string. Returns a new data URL (JPEG).
 * Useful for the document scanner flow.
 */
export function compressDataUrl(
  dataUrl: string,
  options?: CompressOptions
): Promise<string> {
  const { maxDimension, quality } = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const longest = Math.max(width, height);

      if (longest > maxDimension) {
        const scale = maxDimension / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

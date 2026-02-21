import { Capacitor } from '@capacitor/core';

export function isNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Take a photo using the native camera. Returns a data URL or null if cancelled/unavailable.
 */
export async function takeNativePhoto(): Promise<string | null> {
  if (!isNativeCamera()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      '@capacitor/camera'
    );

    const photo = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    return photo.dataUrl ?? null;
  } catch (e: any) {
    // User cancelled
    if (e?.message?.includes('cancelled') || e?.message?.includes('User')) {
      return null;
    }
    console.error('Native camera error:', e);
    return null;
  }
}

/**
 * Pick image(s) from the gallery. Returns an array of data URLs.
 */
export async function pickFromGallery(): Promise<string[]> {
  if (!isNativeCamera()) return [];

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      '@capacitor/camera'
    );

    // Single pick via getPhoto (multi-pick not well supported across platforms)
    const photo = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
    });

    return photo.dataUrl ? [photo.dataUrl] : [];
  } catch (e: any) {
    if (e?.message?.includes('cancelled') || e?.message?.includes('User')) {
      return [];
    }
    console.error('Native gallery error:', e);
    return [];
  }
}

/**
 * Convert a data URL to a File object for upload compatibility.
 */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}

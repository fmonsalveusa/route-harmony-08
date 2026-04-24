import { Capacitor } from '@capacitor/core';

export function isNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Take a photo using the native camera. Returns a data URL or null if cancelled/unavailable.
 * Uses CameraResultType.DataUrl directly — avoids fetch() of capacitor://localhost URLs
 * which breaks when the app uses a remote server.url in capacitor.config.
 * Quality is kept at 75 to avoid memory issues with high-res photos.
 */
export async function takeNativePhoto(): Promise<string | null> {
  if (!isNativeCamera()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      '@capacitor/camera'
    );

    // Request permissions first (required on iPad)
    const perms = await Camera.requestPermissions({ permissions: ['camera'] });
    if (perms.camera === 'denied') {
      throw new Error('PERMISSION_DENIED: Camera permission was denied. Please enable it in Settings.');
    }

    const photo = await Camera.getPhoto({
      quality: 75,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
      // Cap at 2048px — prevents OOM in perspectiveTransform (pure-JS pixel loop)
      // when processing full-resolution iPhone photos (12–48 MP).
      // The native plugin resizes before converting to base64, so JS never
      // receives the giant image.
      width: 2048,
      height: 2048,
      promptLabelHeader: 'Photo',
      promptLabelPhoto: 'From Photos',
      promptLabelPicture: 'Take Picture',
      promptLabelCancel: 'Cancel',
    });

    return photo.dataUrl ?? null;

  } catch (e: any) {
    // User cancelled
    if (
      e?.message?.includes('cancelled') ||
      e?.message?.includes('User') ||
      e?.message?.includes('cancel')
    ) {
      return null;
    }
    console.error('Native camera error:', e);
    if (e?.message?.includes('PERMISSION_DENIED')) {
      throw e;
    }
    throw new Error(`Camera error: ${e?.message || 'Unknown error'}`);
  }
}

/**
 * Pick image(s) from the gallery. Returns an array of data URLs.
 * Uses CameraResultType.DataUrl directly — same reason as takeNativePhoto.
 */
export async function pickFromGallery(): Promise<string[]> {
  if (!isNativeCamera()) return [];

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      '@capacitor/camera'
    );

    // Request permissions first (required on iPad)
    const perms = await Camera.requestPermissions({ permissions: ['photos'] });
    if (perms.photos === 'denied') {
      throw new Error('PERMISSION_DENIED: Photo library permission was denied. Please enable it in Settings.');
    }

    const photo = await Camera.getPhoto({
      quality: 75,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
      // Same cap as camera — prevents OOM in perspectiveTransform.
      width: 2048,
      height: 2048,
      promptLabelHeader: 'Photo',
      promptLabelCancel: 'Cancel',
    });

    return photo.dataUrl ? [photo.dataUrl] : [];

  } catch (e: any) {
    if (
      e?.message?.includes('cancelled') ||
      e?.message?.includes('User') ||
      e?.message?.includes('cancel')
    ) {
      return [];
    }
    console.error('Native gallery error:', e);
    if (e?.message?.includes('PERMISSION_DENIED')) {
      throw e;
    }
    throw new Error(`Gallery error: ${e?.message || 'Unknown error'}`);
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

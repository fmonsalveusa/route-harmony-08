import { Capacitor } from '@capacitor/core';

export function isNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Take a photo using the native camera. Returns a data URL or null if cancelled/unavailable.
 * Uses CameraResultType.Uri + webPath fetch to avoid iOS memory issues with DataUrl on
 * high-resolution photos (12MP+ can be 15MB base64 string, causing silent failures on iOS).
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

    // Use Uri instead of DataUrl — avoids iOS memory crash with large photos.
    // webPath is a Capacitor-served URL (capacitor://localhost/...) that can be fetched.
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true,
      promptLabelHeader: 'Photo',
      promptLabelPhoto: 'From Photos',
      promptLabelPicture: 'Take Picture',
      promptLabelCancel: 'Cancel',
    });

    const webPath = photo.webPath;
    if (!webPath) {
      console.warn('[nativeCamera] webPath is empty — falling back to dataUrl');
      return photo.dataUrl ?? null;
    }

    // Fetch the file from the Capacitor-served URL and convert to data URL
    const response = await fetch(webPath);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader error reading native photo'));
      reader.readAsDataURL(blob);
    });
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
    // Re-throw permission errors so the caller can show a toast
    if (e?.message?.includes('PERMISSION_DENIED')) {
      throw e;
    }
    throw new Error(`Camera error: ${e?.message || 'Unknown error'}`);
  }
}

/**
 * Pick image(s) from the gallery. Returns an array of data URLs.
 * Uses CameraResultType.Uri + webPath fetch to avoid iOS memory issues.
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
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      correctOrientation: true,
      promptLabelHeader: 'Photo',
      promptLabelCancel: 'Cancel',
    });

    const webPath = photo.webPath;
    if (!webPath) {
      console.warn('[nativeCamera] gallery webPath is empty — falling back to dataUrl');
      return photo.dataUrl ? [photo.dataUrl] : [];
    }

    // Fetch the file and convert to data URL
    const response = await fetch(webPath);
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader error reading gallery photo'));
      reader.readAsDataURL(blob);
    });

    return [dataUrl];
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

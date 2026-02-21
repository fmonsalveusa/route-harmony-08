import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

interface PositionCallback {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
}

let watcherId: string | null = null;

export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void
): Promise<() => void> {
  if (!isNativePlatform()) {
    return () => {};
  }

  try {
    const mod = await import('@capacitor-community/background-geolocation');
    const BackgroundGeolocation = mod.default as any;

    watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'GPS tracking is active',
        backgroundTitle: 'Load Up Driver',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      (location, error) => {
        if (error) {
          console.error('Native GPS error:', error);
          return;
        }
        if (location) {
          onPosition({
            lat: location.latitude,
            lng: location.longitude,
            speed: location.speed ?? null,
            heading: location.bearing ?? null,
            accuracy: location.accuracy ?? null,
          });
        }
      }
    );

    return () => {
      stopNativeTracking();
    };
  } catch (e) {
    console.error('Failed to start native tracking:', e);
    return () => {};
  }
}

export async function stopNativeTracking(): Promise<void> {
  if (!watcherId) return;
  try {
    const mod = await import('@capacitor-community/background-geolocation');
    const BackgroundGeolocation = mod.default as any;
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    watcherId = null;
  } catch (e) {
    console.error('Failed to stop native tracking:', e);
  }
}

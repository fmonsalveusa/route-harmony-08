import { Capacitor, registerPlugin } from '@capacitor/core';

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

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: Record<string, unknown>,
    callback: (location?: any, error?: any) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

let watcherId: string | null = null;
let pluginInstance: BackgroundGeolocationPlugin | null = null;

function getBackgroundGeolocation(): BackgroundGeolocationPlugin | null {
  if (!isNativePlatform()) return null;
  if (pluginInstance) return pluginInstance;
  try {
    pluginInstance = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
    return pluginInstance;
  } catch {
    return null;
  }
}

/** Returns true if a native watcher is currently registered */
export function hasActiveWatcher(): boolean {
  return watcherId !== null;
}

export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void
): Promise<() => void> {
  const plugin = getBackgroundGeolocation();
  if (!plugin) return () => {};

  // If a watcher already exists, don't create a duplicate
  if (watcherId !== null) {
    console.log('[NativeTracking] Watcher already active, skipping duplicate');
    return () => { stopNativeTracking(); };
  }

  try {
    watcherId = await plugin.addWatcher(
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

    return () => { stopNativeTracking(); };
  } catch (e) {
    console.error('Failed to start native tracking:', e);
    watcherId = null;
    return () => {};
  }
}

export async function stopNativeTracking(): Promise<void> {
  if (!watcherId) return;
  const plugin = getBackgroundGeolocation();
  if (!plugin) return;
  try {
    await plugin.removeWatcher({ id: watcherId });
    watcherId = null;
  } catch (e) {
    console.error('Failed to stop native tracking:', e);
  }
}

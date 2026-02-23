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
let pluginAvailable: boolean | null = null; // cached result

function getBackgroundGeolocation(): BackgroundGeolocationPlugin | null {
  if (!isNativePlatform()) return null;
  if (pluginInstance) return pluginInstance;
  try {
    pluginInstance = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
    return pluginInstance;
  } catch (e) {
    console.warn('[NativeTracking] Failed to register plugin:', e);
    return null;
  }
}

/**
 * Health-check: verifies the BackgroundGeolocation plugin is truly available
 * by attempting to register it. Returns cached result after first call.
 */
export async function isBackgroundGeolocationAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  if (pluginAvailable !== null) return pluginAvailable;

  try {
    const plugin = getBackgroundGeolocation();
    if (!plugin) {
      pluginAvailable = false;
      console.log('[NativeTracking] Plugin not available (registerPlugin returned null)');
      return false;
    }
    // Plugin object exists — mark as available
    pluginAvailable = true;
    console.log('[NativeTracking] Plugin available ✓');
    return true;
  } catch (e) {
    pluginAvailable = false;
    console.warn('[NativeTracking] Plugin availability check failed:', e);
    return false;
  }
}

/** Returns true if a native watcher is currently registered */
export function hasActiveWatcher(): boolean {
  return watcherId !== null;
}

export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void
): Promise<() => void> {
  // Pre-check availability
  const available = await isBackgroundGeolocationAvailable();
  if (!available) {
    console.warn('[NativeTracking] Skipping start — plugin not available');
    return () => {};
  }

  const plugin = getBackgroundGeolocation();
  if (!plugin) return () => {};

  // If a watcher already exists, don't create a duplicate
  if (watcherId !== null) {
    console.log('[NativeTracking] Watcher already active, skipping duplicate');
    return () => { stopNativeTracking(); };
  }

  try {
    console.log('[NativeTracking] Starting watcher...');
    watcherId = await plugin.addWatcher(
      {
        backgroundMessage: 'GPS tracking is active',
        backgroundTitle: 'Dispatch Up Driver',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      (location, error) => {
        if (error) {
          console.error('[NativeTracking] GPS error:', error);
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

    console.log('[NativeTracking] Watcher started, id:', watcherId);
    return () => { stopNativeTracking(); };
  } catch (e) {
    console.error('[NativeTracking] Failed to start watcher:', e);
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
    console.log('[NativeTracking] Watcher stopped');
  } catch (e) {
    console.error('[NativeTracking] Failed to stop watcher:', e);
  }
}

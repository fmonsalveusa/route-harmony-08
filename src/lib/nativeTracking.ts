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

const NATIVE_GPS_ENABLED = true;
const WATCHER_ID_KEY = 'native_bg_watcher_id';

let pluginInstance: BackgroundGeolocationPlugin | null = null;
let pluginAvailable: boolean | null = null;
let currentWatcherId: string | null = null;

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
 * Health-check: verifies the BackgroundGeolocation plugin is truly available.
 */
export async function isBackgroundGeolocationAvailable(): Promise<boolean> {
  if (!NATIVE_GPS_ENABLED) {
    console.log('[NativeTracking] Native GPS is disabled (NATIVE_GPS_ENABLED=false)');
    return false;
  }
  if (!isNativePlatform()) return false;
  if (pluginAvailable !== null) return pluginAvailable;

  try {
    const plugin = getBackgroundGeolocation();
    if (!plugin) {
      pluginAvailable = false;
      return false;
    }
    const testId = await Promise.race([
      plugin.addWatcher(
        { backgroundMessage: 'test', backgroundTitle: 'test', requestPermissions: false, stale: true, distanceFilter: 99999 },
        () => {}
      ),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    await plugin.removeWatcher({ id: testId }).catch(() => {});
    pluginAvailable = true;
    console.log('[NativeTracking] Plugin available ✓');
    return true;
  } catch (e) {
    pluginAvailable = false;
    console.warn('[NativeTracking] Plugin NOT available:', e);
    return false;
  }
}

/** Returns true if a native watcher is currently registered in this JS session */
export function hasActiveWatcher(): boolean {
  return currentWatcherId !== null;
}

/** Clean up any orphaned watcher from a previous JS session */
async function cleanupOrphanedWatcher(): Promise<void> {
  const plugin = getBackgroundGeolocation();
  if (!plugin) return;

  // Clean in-memory watcher first
  if (currentWatcherId) {
    console.log('[NativeTracking] Removing current in-memory watcher:', currentWatcherId);
    await plugin.removeWatcher({ id: currentWatcherId }).catch(() => {});
    currentWatcherId = null;
  }

  // Clean persisted watcher (orphan from destroyed WebView)
  const savedId = localStorage.getItem(WATCHER_ID_KEY);
  if (savedId) {
    console.log('[NativeTracking] Removing orphaned watcher from localStorage:', savedId);
    await plugin.removeWatcher({ id: savedId }).catch(() => {});
    localStorage.removeItem(WATCHER_ID_KEY);
  }
}

export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void
): Promise<() => void> {
  const available = await isBackgroundGeolocationAvailable();
  if (!available) {
    console.warn('[NativeTracking] Skipping start — plugin not available');
    return () => {};
  }

  const plugin = getBackgroundGeolocation();
  if (!plugin) return () => {};

  // Always cleanup before creating a new watcher
  await cleanupOrphanedWatcher();

  try {
    console.log('[NativeTracking] Starting new watcher...');
    const id = await plugin.addWatcher(
      {
        backgroundMessage: 'Tracking location',
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

    currentWatcherId = id;
    localStorage.setItem(WATCHER_ID_KEY, id);
    console.log('[NativeTracking] Watcher started, id:', id);
    return () => { stopNativeTracking(); };
  } catch (e) {
    console.error('[NativeTracking] Failed to start watcher:', e);
    currentWatcherId = null;
    localStorage.removeItem(WATCHER_ID_KEY);
    return () => {};
  }
}

export async function stopNativeTracking(): Promise<void> {
  const plugin = getBackgroundGeolocation();
  if (!plugin) return;

  const idToRemove = currentWatcherId || localStorage.getItem(WATCHER_ID_KEY);
  if (!idToRemove) return;

  try {
    await plugin.removeWatcher({ id: idToRemove });
    console.log('[NativeTracking] Watcher stopped:', idToRemove);
  } catch (e) {
    console.error('[NativeTracking] Failed to stop watcher:', e);
  }
  currentWatcherId = null;
  localStorage.removeItem(WATCHER_ID_KEY);
}

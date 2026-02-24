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
const PLUGIN_AVAILABLE_KEY = 'native_gps_plugin_available';
const BATTERY_SAVER_KEY = 'gps_battery_saver';

let pluginInstance: BackgroundGeolocationPlugin | null = null;
let currentWatcherId: string | null = null;

function getBackgroundGeolocation(): BackgroundGeolocationPlugin | null {
  if (!isNativePlatform()) return null;
  if (pluginInstance) return pluginInstance;

  // If we already know the plugin is not available, don't even try
  const cached = localStorage.getItem(PLUGIN_AVAILABLE_KEY);
  if (cached === 'false') {
    console.log('[NativeTracking] Plugin previously marked unavailable, skipping registerPlugin');
    return null;
  }

  try {
    pluginInstance = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
    return pluginInstance;
  } catch (e) {
    console.warn('[NativeTracking] Failed to register plugin:', e);
    localStorage.setItem(PLUGIN_AVAILABLE_KEY, 'false');
    return null;
  }
}

/** Check if battery saver mode is enabled */
export function isBatterySaverEnabled(): boolean {
  return localStorage.getItem(BATTERY_SAVER_KEY) === 'true';
}

/** Toggle battery saver mode */
export function setBatterySaver(enabled: boolean): void {
  localStorage.setItem(BATTERY_SAVER_KEY, enabled ? 'true' : 'false');
}

/**
 * Health-check: verifies the BackgroundGeolocation plugin is truly available.
 * Uses localStorage cache to avoid repeated test-watcher calls that can crash.
 */
export async function isBackgroundGeolocationAvailable(): Promise<boolean> {
  if (!NATIVE_GPS_ENABLED) return false;
  if (!isNativePlatform()) return false;

  const cached = localStorage.getItem(PLUGIN_AVAILABLE_KEY);
  if (cached === 'true') return true;
  if (cached === 'false') return false;

  try {
    const plugin = getBackgroundGeolocation();
    if (!plugin) {
      localStorage.setItem(PLUGIN_AVAILABLE_KEY, 'false');
      return false;
    }
    const testId = await Promise.race([
      plugin.addWatcher(
        { backgroundMessage: 'test', backgroundTitle: 'test', requestPermissions: false, stale: true, distanceFilter: 99999 },
        () => {}
      ),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    await plugin.removeWatcher({ id: testId }).catch(() => {});
    localStorage.setItem(PLUGIN_AVAILABLE_KEY, 'true');
    console.log('[NativeTracking] Plugin available ✓');
    return true;
  } catch (e) {
    localStorage.setItem(PLUGIN_AVAILABLE_KEY, 'false');
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

  if (currentWatcherId) {
    console.log('[NativeTracking] Removing current in-memory watcher:', currentWatcherId);
    await plugin.removeWatcher({ id: currentWatcherId }).catch(() => {});
    currentWatcherId = null;
  }

  const savedId = localStorage.getItem(WATCHER_ID_KEY);
  if (savedId) {
    console.log('[NativeTracking] Removing orphaned watcher from localStorage:', savedId);
    await plugin.removeWatcher({ id: savedId }).catch(() => {});
    localStorage.removeItem(WATCHER_ID_KEY);
  }
}

export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void,
  requestPermissions = true
): Promise<() => void> {
  const plugin = getBackgroundGeolocation();
  if (!plugin) {
    console.warn('[NativeTracking] No plugin instance');
    return () => {};
  }

  await cleanupOrphanedWatcher().catch(() => {});

  const batterySaver = isBatterySaverEnabled();
  const distanceFilter = batterySaver ? 200 : 50;
  console.log('[NativeTracking] Starting watcher, distanceFilter:', distanceFilter, 'batterySaver:', batterySaver);

  try {
    console.log('[NativeTracking] Starting new watcher...');
    const id = await plugin.addWatcher(
      {
        backgroundMessage: 'Tracking location',
        backgroundTitle: 'Dispatch Up Driver',
        requestPermissions,
        stale: false,
        distanceFilter,
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
    localStorage.setItem(PLUGIN_AVAILABLE_KEY, 'true');
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

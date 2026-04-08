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

const WATCHER_ID_KEY = 'native_bg_watcher_id';
const BATTERY_SAVER_KEY = 'gps_battery_saver';

// Active watch ID in this JS session
let currentWatchId: string | null = null;

/** Check if battery saver mode is enabled */
export function isBatterySaverEnabled(): boolean {
  return localStorage.getItem(BATTERY_SAVER_KEY) === 'true';
}

/** Toggle battery saver mode */
export function setBatterySaver(enabled: boolean): void {
  localStorage.setItem(BATTERY_SAVER_KEY, enabled ? 'true' : 'false');
}

/**
 * Returns true if native geolocation is available and not denied.
 * Used by DriverTrackingContext to decide whether to use native or web GPS.
 */
export async function isBackgroundGeolocationAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perms = await Geolocation.checkPermissions();
    // 'granted' or 'prompt' — both allow us to proceed (we'll request on start)
    return perms.location !== 'denied';
  } catch (e) {
    console.warn('[NativeTracking] Could not check permissions:', e);
    return false;
  }
}

/** Returns true if a native watcher is currently active in this JS session */
export function hasActiveWatcher(): boolean {
  return currentWatchId !== null;
}

/**
 * Start native GPS tracking using @capacitor/geolocation.
 * On iOS with Background Modes → Location updates enabled in Xcode,
 * this continues sending positions even when the app is in the background.
 *
 * Requires in Info.plist:
 *   NSLocationAlwaysAndWhenInUseUsageDescription
 *   NSLocationAlwaysUsageDescription
 *   NSLocationWhenInUseUsageDescription
 *
 * Requires in Xcode → Signing & Capabilities → Background Modes:
 *   ✅ Location updates
 */
export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void,
  requestPermissions = true
): Promise<() => void> {
  if (!isNativePlatform()) {
    console.warn('[NativeTracking] Not a native platform, skipping');
    return () => {};
  }

  // Clean up any leftover watcher from a previous session
  await stopNativeTracking();

  try {
    const { Geolocation } = await import('@capacitor/geolocation');

    if (requestPermissions) {
      const perms = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (perms.location === 'denied') {
        throw new Error('PERMISSION_DENIED: Location permission denied. Enable it in Settings → Privacy → Location Services.');
      }
    }

    const batterySaver = isBatterySaverEnabled();
    console.log('[NativeTracking] Starting watcher, batterySaver:', batterySaver);

    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: !batterySaver,   // high accuracy = GPS chip; false = network/wifi
        timeout: 15000,
        maximumAge: batterySaver ? 30000 : 0,
      },
      (position, err) => {
        if (err) {
          console.error('[NativeTracking] GPS error:', err);
          return;
        }
        if (position) {
          onPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed ?? null,
            heading: position.coords.heading ?? null,
            accuracy: position.coords.accuracy ?? null,
          });
        }
      }
    );

    currentWatchId = watchId;
    localStorage.setItem(WATCHER_ID_KEY, watchId);
    console.log('[NativeTracking] Watcher started, id:', watchId);

    return () => { stopNativeTracking(); };
  } catch (e: any) {
    console.error('[NativeTracking] Failed to start watcher:', e);
    currentWatchId = null;
    localStorage.removeItem(WATCHER_ID_KEY);
    // Re-throw permission errors so DriverTrackingContext can show a toast
    if (e?.message?.includes('PERMISSION_DENIED')) throw e;
    return () => {};
  }
}

/** Stop the active native GPS watcher */
export async function stopNativeTracking(): Promise<void> {
  const idToRemove = currentWatchId ?? localStorage.getItem(WATCHER_ID_KEY);
  if (!idToRemove) return;

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.clearWatch({ id: idToRemove });
    console.log('[NativeTracking] Watcher stopped:', idToRemove);
  } catch (e) {
    console.error('[NativeTracking] Failed to stop watcher:', e);
  }

  currentWatchId = null;
  localStorage.removeItem(WATCHER_ID_KEY);
}

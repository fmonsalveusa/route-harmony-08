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

const BATTERY_SAVER_KEY = 'gps_battery_saver';

// Marca si hay un watcher de background activo en esta sesión JS.
// El plugin @capgo/background-geolocation maneja un solo stream global (start/stop),
// no IDs por watcher, así que usamos un booleano.
let isWatching = false;

/** Check if battery saver mode is enabled */
export function isBatterySaverEnabled(): boolean {
  return localStorage.getItem(BATTERY_SAVER_KEY) === 'true';
}

/** Toggle battery saver mode */
export function setBatterySaver(enabled: boolean): void {
  localStorage.setItem(BATTERY_SAVER_KEY, enabled ? 'true' : 'false');
}

/**
 * Returns true if native geolocation is available (plataforma nativa).
 * Usado por DriverTrackingContext para decidir entre nativo o web.
 * No consultamos permisos aquí porque el plugin los pide al hacer start().
 */
export async function isBackgroundGeolocationAvailable(): Promise<boolean> {
  return isNativePlatform();
}

/** Returns true si hay un watcher nativo activo en esta sesión */
export function hasActiveWatcher(): boolean {
  return isWatching;
}

/**
 * Inicia el tracking GPS en BACKGROUND usando @capgo/background-geolocation.
 * A diferencia de @capacitor/geolocation (que solo reporta en foreground),
 * este plugin sigue reportando ubicaciones con la app minimizada o el teléfono bloqueado.
 *
 * Requiere en Info.plist (iOS):
 *   NSLocationWhenInUseUsageDescription
 *   NSLocationAlwaysAndWhenInUseUsageDescription
 *   UIBackgroundModes → location
 *
 * En Android: muestra una notificación persistente mientras trackea (obligatorio
 * para background), y en Android 13+ pide permiso POST_NOTIFICATIONS.
 */
export async function startNativeTracking(
  onPosition: (pos: PositionCallback) => void,
  requestPermissions = true
): Promise<() => void> {
  if (!isNativePlatform()) {
    console.warn('[NativeTracking] Not a native platform, skipping');
    return () => {};
  }

  // Limpiar cualquier stream anterior antes de arrancar uno nuevo
  await stopNativeTracking();

  try {
    const { BackgroundGeolocation } = await import('@capgo/background-geolocation');

    const batterySaver = isBatterySaverEnabled();
    // distanceFilter: metros que el driver debe moverse para generar un nuevo update.
    // En modo ahorro filtramos más (menos updates), en modo normal filtramos menos.
    const distanceFilter = batterySaver ? 100 : 30;

    console.log('[NativeTracking] Starting background watcher, batterySaver:', batterySaver);

    await BackgroundGeolocation.start(
      {
        // backgroundMessage definido = el plugin reporta en background (no solo foreground).
        // En Android este texto va en la notificación persistente obligatoria.
        backgroundMessage: 'Tracking your location for active loads.',
        backgroundTitle: 'Dispatch Up — On Route',
        requestPermissions,
        stale: false,          // solo ubicaciones actualizadas, no cacheadas
        distanceFilter,
      },
      (location, error) => {
        if (error) {
          console.error('[NativeTracking] GPS error:', error);
          // El plugin usa code 'NOT_AUTHORIZED' cuando falta permiso.
          if ((error as any)?.code === 'NOT_AUTHORIZED') {
            // No lanzamos aquí (estamos en callback async); el contexto ya mostró UI de permisos.
          }
          return;
        }
        if (location) {
          onPosition({
            lat: location.latitude,
            lng: location.longitude,
            speed: location.speed ?? null,
            heading: location.bearing ?? null,   // el plugin llama 'bearing' al heading
            accuracy: location.accuracy ?? null,
          });
        }
      }
    );

    isWatching = true;
    console.log('[NativeTracking] Background watcher started');

    return () => { stopNativeTracking(); };
  } catch (e: any) {
    console.error('[NativeTracking] Failed to start background watcher:', e);
    isWatching = false;
    if (e?.message?.includes('PERMISSION_DENIED') || e?.code === 'NOT_AUTHORIZED') {
      throw new Error('PERMISSION_DENIED: Location permission denied. Enable it in Settings.');
    }
    return () => {};
  }
}

/** Detiene el watcher de background */
export async function stopNativeTracking(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { BackgroundGeolocation } = await import('@capgo/background-geolocation');
    await BackgroundGeolocation.stop();
    console.log('[NativeTracking] Background watcher stopped');
  } catch (e) {
    console.error('[NativeTracking] Failed to stop watcher:', e);
  }
  isWatching = false;
}

/** Abre los ajustes del sistema para que el usuario habilite permisos de ubicación */
export async function openLocationSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { BackgroundGeolocation } = await import('@capgo/background-geolocation');
    await BackgroundGeolocation.openSettings();
  } catch (e) {
    console.error('[NativeTracking] Failed to open settings:', e);
  }
}

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

export interface BackgroundPermissionStatus {
  /** Ubicación en foreground concedida */
  location: boolean;
  /** Ubicación en background ("Allow all the time" / "Always") concedida */
  background: boolean;
  /** Notificaciones concedidas — Android 13+ las exige para el foreground service */
  notification: boolean;
}

async function readPermissions(): Promise<BackgroundPermissionStatus> {
  const { BackgroundGeolocation } = await import('@capgo/background-geolocation');
  const s = await BackgroundGeolocation.checkPermissions();
  return {
    location: s.location === 'granted',
    // En iOS 'when_in_use' significa que SOLO tiene foreground — no sirve para background.
    background: s.backgroundLocation === 'granted' || s.backgroundLocation === 'always',
    notification: s.notification === 'granted',
  };
}

/**
 * Lee el estado de permisos sin mostrar diálogos.
 * Devuelve null si no se pudo leer, que casi siempre significa que la app instalada
 * es vieja y no trae el plugin. Eso NO es lo mismo que "el driver lo negó".
 */
export async function checkBackgroundPermissions(): Promise<BackgroundPermissionStatus | null> {
  if (!isNativePlatform()) return null;
  try {
    return await readPermissions();
  } catch (e) {
    console.error('[NativeTracking] checkPermissions failed:', e);
    return null;
  }
}

/** Versión instalada de la app, para saber quién tiene una build vieja */
export async function getAppVersion(): Promise<string | null> {
  if (!isNativePlatform()) return null;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return null;
  }
}

/**
 * Pide los permisos necesarios para trackear en background.
 *
 * El orden importa: Android 10+ rechaza ACCESS_BACKGROUND_LOCATION si se pide
 * junto con el permiso de foreground. Hay que pedir foreground primero, esperar
 * que lo concedan, y recién entonces pedir background.
 *
 * En Android 11+ el sistema suele negar el de background sin mostrar diálogo —
 * el usuario tiene que ir a Ajustes y elegir "Permitir todo el tiempo". Por eso
 * devolvemos el estado en vez de asumir que quedó concedido.
 */
export async function requestBackgroundPermissions(): Promise<BackgroundPermissionStatus> {
  if (!isNativePlatform()) return { location: false, background: false, notification: false };

  try {
    const { BackgroundGeolocation } = await import('@capgo/background-geolocation');

    let status = await readPermissions();

    // 1) Foreground + notificación (un solo diálogo cada uno)
    if (!status.location || !status.notification) {
      const pending: ('location' | 'notification')[] = [];
      if (!status.location) pending.push('location');
      if (!status.notification) pending.push('notification');
      await BackgroundGeolocation.requestPermissions({ permissions: pending });
      status = await readPermissions();
    }

    // 2) Background — solo tiene sentido si ya concedieron foreground
    if (status.location && !status.background) {
      await BackgroundGeolocation.requestPermissions({ permissions: ['backgroundLocation'] });
      status = await readPermissions();
    }

    console.log('[NativeTracking] Permissions after request:', status);
    return status;
  } catch (e) {
    console.error('[NativeTracking] requestPermissions failed:', e);
    return { location: false, background: false, notification: false };
  }
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

    // El plugin en su start() solo pide el permiso de foreground. Sin
    // ACCESS_BACKGROUND_LOCATION Android entrega ubicaciones únicamente con la
    // app abierta, así que lo pedimos explícitamente antes de arrancar.
    if (requestPermissions) {
      const perms = await requestBackgroundPermissions();
      if (!perms.location) {
        throw new Error('PERMISSION_DENIED: Location permission denied. Enable it in Settings.');
      }
      if (!perms.background) {
        console.warn('[NativeTracking] Background location NOT granted — tracking will stop when the app is closed');
      }
    }

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

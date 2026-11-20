/**
 * Estado del GPS de un driver para Tracking: si la app está reportando y, si no, por qué
 * (según los permisos que la app reporta con report_gps_status) y qué tiene que hacer el driver.
 */

export type GpsLevel = 'ok' | 'eld' | 'warn' | 'error';

export interface GpsHealth {
  level: GpsLevel;
  /** Texto corto del chip */
  label: string;
  /** Explicación para el dispatcher */
  detail: string;
  /** Instrucciones para mandarle al driver (null si no hay nada que arreglar) */
  fix: string | null;
}

interface DriverGpsFields {
  name: string;
  app_version?: string | null;
  gps_platform?: string | null;
  gps_location_granted?: boolean | null;
  gps_background_granted?: boolean | null;
  gps_notification_granted?: boolean | null;
  gps_plugin_ok?: boolean | null;
  gps_permission_checked_at?: string | null;
}

interface LocFields { updated_at: string; source?: string | null }

const LIVE_MS = 30 * 60 * 1000;
const ELD_FRESH_MS = 24 * 3600 * 1000;

const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} días`;
};

export function getGpsHealth(driver: DriverGpsFields, loc: LocFields | undefined, now = Date.now()): GpsHealth {
  const first = (driver.name || '').trim().split(/\s+/)[0] || '';
  const hi = `Hola ${first} 👋`;
  const ios = driver.gps_platform === 'ios';
  const android = driver.gps_platform === 'android';
  const age = loc ? now - new Date(loc.updated_at).getTime() : null;
  const fromEld = loc?.source === 'eld';
  const appLive = !!loc && !fromEld && age != null && age <= LIVE_MS;
  const eldFresh = !!loc && fromEld && age != null && age <= ELD_FRESH_MS;
  const eldNote = eldFresh ? ' La ubicación se está tomando del ELD mientras tanto.' : '';

  if (appLive) return { level: 'ok', label: 'GPS OK', detail: 'La app está enviando la ubicación.', fix: null };

  const settingsPath = ios
    ? 'Ajustes del iPhone → Dispatch Up → Ubicación → *Siempre*, y activa *Ubicación exacta*'
    : android
      ? 'Ajustes → Apps → Dispatch Up → Permisos → Ubicación → *Permitir todo el tiempo*, y activa *Usar ubicación precisa*'
      : 'los ajustes del teléfono → Dispatch Up → Ubicación → *Permitir siempre / todo el tiempo*';

  // Problemas de la app, del más grave al más leve
  if (!driver.app_version && !driver.gps_permission_checked_at) {
    return {
      level: 'error', label: 'Nunca abrió la app',
      detail: `No ha iniciado sesión en la app de Dispatch Up.${eldNote}`,
      fix: `${hi}\nPara poder darte seguimiento en las cargas necesitamos que instales la app *Dispatch Up Driver* (App Store o Play Store) e inicies sesión con tu correo.\nAl abrirla acepta los permisos de ubicación y deja la opción *Permitir siempre*. ¡Gracias!`,
    };
  }
  if (driver.gps_plugin_ok === false) {
    return {
      level: 'error', label: 'App vieja',
      detail: `Tiene una versión de la app sin GPS en segundo plano (${driver.app_version || 'versión desconocida'}).${eldNote}`,
      fix: `${hi}\nTu app de Dispatch Up está desactualizada. Por favor actualízala desde ${ios ? 'el App Store' : android ? 'Play Store' : 'la tienda de tu teléfono'}, ábrela e inicia sesión. Así el GPS funciona aunque tengas la app cerrada. ¡Gracias!`,
    };
  }
  if (driver.gps_location_granted === false) {
    return {
      level: 'error', label: 'Ubicación denegada',
      detail: `Le negó el permiso de ubicación a la app.${eldNote}`,
      fix: `${hi}\nLa app de Dispatch Up no tiene permiso de ubicación. Por favor entra a ${settingsPath}. Luego abre la app una vez. ¡Gracias!`,
    };
  }
  if (driver.gps_background_granted === false) {
    return {
      level: 'warn', label: 'Sin "Permitir siempre"',
      detail: `La ubicación solo se envía con la app abierta en pantalla.${eldNote}`,
      fix: `${hi}\nPara que el GPS siga funcionando con la app minimizada o la pantalla apagada, entra a ${settingsPath}. Luego abre la app una vez. ¡Gracias!`,
    };
  }
  if (android && driver.gps_notification_granted === false) {
    return {
      level: 'warn', label: 'Notificaciones apagadas',
      detail: `En Android, sin notificaciones el sistema detiene el GPS en segundo plano.${eldNote}`,
      fix: `${hi}\nPor favor activa las notificaciones de Dispatch Up: Ajustes → Apps → Dispatch Up → Notificaciones → *Permitir*. Sin eso Android apaga el GPS cuando la app está minimizada. ¡Gracias!`,
    };
  }

  if (eldFresh) return { level: 'eld', label: 'ELD', detail: 'La app no está enviando; la ubicación viene del ELD.', fix: null };

  // Permisos bien pero no reporta: app cerrada (en iPhone, si la cierran deslizando se detiene)
  const since = age != null ? `hace ${ago(age)}` : 'nunca';
  return {
    level: 'warn', label: age != null ? `Sin GPS ${ago(age)}` : 'Sin GPS',
    detail: `Los permisos están bien, pero la app no envía ubicación (última: ${since}). Seguramente la cerró o no tiene el tracking activo.`,
    fix: `${hi}\nNo estamos recibiendo tu ubicación. Por favor abre la app de Dispatch Up y verifica que el *GPS Tracking* esté activado.${ios ? ' En iPhone, no la cierres deslizándola hacia arriba: solo minimízala.' : ' Si el teléfono tiene ahorro de batería, quita a Dispatch Up de la lista de apps restringidas.'} ¡Gracias!`,
  };
}

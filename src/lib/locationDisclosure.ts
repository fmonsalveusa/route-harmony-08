/**
 * Aviso destacado de ubicación (exigido por Google Play para ACCESS_BACKGROUND_LOCATION):
 * antes de pedir el permiso, la app explica qué datos recoge, para qué, y que sigue
 * funcionando con la app cerrada. Solo se pide el permiso si el driver acepta.
 *
 * La pantalla la dibuja <LocationDisclosureDialog /> (montado en el layout del driver);
 * aquí solo se coordina la pregunta y se recuerda la respuesta.
 */
const KEY = 'location_disclosure_accepted_v1';
type Listener = (resolve: (ok: boolean) => void) => void;

let listener: Listener | null = null;
let pending: Promise<boolean> | null = null;

export function onLocationDisclosureRequest(l: Listener | null) {
  listener = l;
}

function accepted(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** true si el driver aceptó el aviso (ahora o antes). Sin pantalla montada, no bloquea. */
export function ensureLocationDisclosure(): Promise<boolean> {
  if (accepted()) return Promise.resolve(true);
  if (!listener) return Promise.resolve(true);
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => {
    listener!((ok) => {
      if (ok) { try { localStorage.setItem(KEY, '1'); } catch { /* sin storage */ } }
      pending = null;
      resolve(ok);
    });
  });
  return pending;
}

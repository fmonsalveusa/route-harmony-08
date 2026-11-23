/**
 * ETA a una parada y comparación con su ventana de cita.
 * La hora de la cita está en la hora local de la parada, así que el ETA se muestra
 * en esa misma zona (sacada del estado de la dirección).
 */

const STATE_TZ: Record<string, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York',
  IN: 'America/Indiana/Indianapolis', ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit',
  NH: 'America/New_York', NJ: 'America/New_York', NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York',
  PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York', VT: 'America/New_York', VA: 'America/New_York',
  WV: 'America/New_York', KY: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago', IA: 'America/Chicago', KS: 'America/Chicago',
  LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago', NE: 'America/Chicago',
  ND: 'America/Chicago', OK: 'America/Chicago', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  WI: 'America/Chicago',
  // Mountain / Pacific / otros
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Boise', MT: 'America/Denver', NM: 'America/Denver',
  UT: 'America/Denver', WY: 'America/Denver', CA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  OR: 'America/Los_Angeles', WA: 'America/Los_Angeles', AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
};

const TZ_SHORT: Record<string, string> = {
  'America/New_York': 'ET', 'America/Detroit': 'ET', 'America/Indiana/Indianapolis': 'ET',
  'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Boise': 'MT', 'America/Phoenix': 'MT',
  'America/Los_Angeles': 'PT', 'America/Anchorage': 'AKT', 'Pacific/Honolulu': 'HT',
};

/** Zona horaria de la parada según el estado de la dirección ("..., Dallas, TX 75201") */
export function stopTimeZone(address: string | null | undefined): string {
  const m = (address || '').toUpperCase().match(/\b([A-Z]{2})\b\s*(\d{5}(-\d{4})?)?\s*(,\s*(USA|US|UNITED STATES))?\s*$/);
  return (m && STATE_TZ[m[1]]) || 'America/New_York';
}

/** Minutos UTC del offset de una zona en una fecha (ej. -300 para ET en invierno) */
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "8:00 AM", "14:30", "0800" → minutos desde medianoche */
function parseClock(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM|A|P)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = (m[3] || '').toUpperCase();
  if (ap.startsWith('P') && h < 12) h += 12;
  if (ap.startsWith('A') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function appointmentAt(date: string | null | undefined, time: string | null | undefined, tz: string, which: 'first' | 'last'): Date | null {
  if (!date) return null;
  const clocks = (time || '').match(/\b\d{4}\b|\d{1,2}(:\d{2})?\s*(AM|PM|A\b|P\b)?/gi) || [];
  const mins = clocks.map(parseClock).filter((x): x is number => x != null);
  if (mins.length === 0) return null;
  const at = which === 'first' ? mins[0] : mins[mins.length - 1];
  const [y, mo, d] = date.slice(0, 10).split('-').map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, Math.floor(at / 60), at % 60);
  return new Date(naiveUtc - tzOffsetMinutes(tz, new Date(naiveUtc)) * 60000);
}

/** Fin de la ventana de cita como instante real (o null si no hay fecha/hora entendible) */
export function appointmentEnd(date: string | null | undefined, time: string | null | undefined, tz: string): Date | null {
  return appointmentAt(date, time, tz, 'last');
}

/** Inicio de la ventana de cita (la primera hora del texto: "08:00-14:00" → 8:00) */
export function appointmentStart(date: string | null | undefined, time: string | null | undefined, tz: string): Date | null {
  return appointmentAt(date, time, tz, 'first');
}

export interface StopEta {
  /** "4:30 PM CT" (hora local de la parada) */
  label: string;
  /** true: llega después del fin de la cita · false: a tiempo · null: no hay cita para comparar */
  late: boolean | null;
}

export function stopEta(minutesAway: number, stop: { address: string; date?: string | null; time?: string | null }, now = new Date()): StopEta {
  const tz = stopTimeZone(stop.address);
  const eta = new Date(now.getTime() + minutesAway * 60000);
  const sameDay = eta.toLocaleDateString('en-US', { timeZone: tz }) === now.toLocaleDateString('en-US', { timeZone: tz });
  const label =
    (sameDay ? '' : eta.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' }) + ' ') +
    eta.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }) +
    ' ' + (TZ_SHORT[tz] || '');
  const end = appointmentEnd(stop.date, stop.time, tz);
  return { label, late: end ? eta.getTime() > end.getTime() : null };
}

import { appointmentEnd, appointmentStart, stopTimeZone } from '@/lib/stopEta';

/** Horas gratis antes de cobrar detention */
export const DETENTION_FREE_MIN = 120;
/** $/hora si la carga no tiene tarifa propia */
export const DETENTION_DEFAULT_RATE = 40;
/** Se avisa al dispatcher desde aquí (para avisarle al broker antes de las 2 h) */
export const DETENTION_WARN_MIN = 90;

export interface DetentionStop {
  id: string;
  load_id?: string;
  stop_type: string;
  stop_order?: number;
  address: string;
  date?: string | null;
  time?: string | null;
  arrived_at?: string | null;
  departed_at?: string | null;
}

export interface StopDetention {
  /** Desde cuándo corre el reloj: la cita si llegó temprano, si no la llegada */
  clockStart: Date;
  /** Salida (o ahora si sigue en la parada) */
  clockEnd: Date;
  /** true = sigue en la parada */
  open: boolean;
  /** Minutos esperando (desde clockStart) */
  waitedMin: number;
  /** Minutos cobrables (pasadas las 2 h gratis) */
  billableMin: number;
  /** Llegó después de la cita: el broker normalmente no paga detention */
  lateArrival: boolean;
}

/**
 * Detention de una parada. Null si no hay llegada marcada.
 * El reloj arranca a la hora de la cita si el driver llegó antes; si llegó tarde
 * (más de 15 min después del fin de la ventana) se marca lateArrival.
 */
export function stopDetention(stop: DetentionStop, now = new Date()): StopDetention | null {
  if (!stop.arrived_at) return null;
  const arrived = new Date(stop.arrived_at);
  const tz = stopTimeZone(stop.address);
  const apptStart = appointmentStart(stop.date, stop.time, tz);
  const apptEnd = appointmentEnd(stop.date, stop.time, tz);
  const clockStart = apptStart && apptStart > arrived ? apptStart : arrived;
  const open = !stop.departed_at;
  const clockEnd = stop.departed_at ? new Date(stop.departed_at) : now;
  const waitedMin = Math.max(0, Math.round((clockEnd.getTime() - clockStart.getTime()) / 60000));
  // Una espera de más de 24 h casi seguro es un dato mal marcado: no se cuenta
  const sane = waitedMin <= 24 * 60;
  const lateArrival = !!apptEnd && arrived.getTime() > apptEnd.getTime() + 15 * 60000;
  return {
    clockStart, clockEnd, open,
    waitedMin: sane ? waitedMin : 0,
    billableMin: sane ? Math.max(0, waitedMin - DETENTION_FREE_MIN) : 0,
    lateArrival,
  };
}

/** Total cobrable de la carga (solo paradas ya terminadas y con llegada a tiempo) */
export function loadDetention(stops: DetentionStop[], rate?: number | null) {
  let billableMin = 0;
  const perStop = stops.map(s => ({ stop: s, d: stopDetention(s) }));
  for (const { d } of perStop) if (d && !d.open && !d.lateArrival) billableMin += d.billableMin;
  const r = Number(rate) > 0 ? Number(rate) : DETENTION_DEFAULT_RATE;
  return { perStop, billableMin, rate: r, amount: Math.round((billableMin / 60) * r * 100) / 100 };
}

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

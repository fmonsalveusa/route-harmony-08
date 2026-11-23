import { todayET } from '@/lib/dateUtils';
import { DetentionStop, DETENTION_WARN_MIN, fmtDuration, stopDetention } from '@/lib/detention';

/** Datos mínimos de una carga para revisar si tiene algo raro */
export interface AlertableLoad {
  status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  truck_id: string | null;
  driver_id?: string | null;
  status_changed_at?: string | null;
}

export interface LoadAlert {
  code: 'future_in_progress' | 'stuck' | 'overdue' | 'no_truck' | 'no_driver' | 'no_stop_coords' | 'detention';
  label: string;
}

/** Status en curso (el camión ya salió a buscar o lleva la carga) */
const IN_PROGRESS = ['in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];
const FINISHED = ['delivered', 'tonu', 'cancelled', 'paid'];
const ON_SITE = ['on_site_pickup', 'on_site_delivery'];
/** Horas en el sitio (On Site) a partir de las cuales se considera trabada */
const STUCK_HOURS = 6;

const STATUS_LABEL: Record<string, string> = {
  dispatched: 'Dispatched', in_transit: 'In Transit', on_site_pickup: 'On Site Pickup',
  picked_up: 'Picked Up', on_site_delivery: 'On Site Delivery',
};

/**
 * Revisa una carga activa y devuelve lo que no cuadra (status vs. fechas, cargas trabadas,
 * datos que faltan). `stopsWithCoords` = cuántas paradas tienen coordenadas, si se conoce.
 */
export function getLoadAlerts(load: AlertableLoad, opts: { stopsWithCoords?: number; now?: Date; stops?: DetentionStop[] } = {}): LoadAlert[] {
  if (FINISHED.includes(load.status)) return [];
  const alerts: LoadAlert[] = [];
  const today = todayET();
  const now = opts.now ?? new Date();

  if (IN_PROGRESS.includes(load.status) && load.pickup_date && load.pickup_date > today) {
    alerts.push({ code: 'future_in_progress', label: `${STATUS_LABEL[load.status] || load.status} con pickup el ${fmtDay(load.pickup_date)}` });
  }

  if (load.delivery_date && load.delivery_date < today) {
    alerts.push({ code: 'overdue', label: `Entrega era el ${fmtDay(load.delivery_date)} y no está Delivered` });
  }

  if (load.status !== 'planned' && load.status_changed_at) {
    const hours = (now.getTime() - new Date(load.status_changed_at).getTime()) / 3600_000;
    // Solo en el sitio (pickup/entrega): en ruta o despachada por muchas horas es normal en viajes largos
    if (hours >= STUCK_HOURS && ON_SITE.includes(load.status)) {
      alerts.push({ code: 'stuck', label: `${fmtHours(hours)} en ${STATUS_LABEL[load.status] || load.status}` });
    }
  }

  // Detention: el driver lleva mucho en una parada (se avisa a la 1:30 para avisarle al broker a tiempo)
  for (const s of opts.stops ?? []) {
    const d = stopDetention(s, now);
    if (!d || !d.open || d.waitedMin < DETENTION_WARN_MIN || d.waitedMin > 24 * 60) continue;
    const where = s.stop_type === 'pickup' ? 'pickup' : 'delivery';
    alerts.push({
      code: 'detention',
      label: d.billableMin > 0
        ? `Detention: ${fmtDuration(d.waitedMin)} en ${where} (${fmtDuration(d.billableMin)} cobrable)${d.lateArrival ? ' · llegó tarde' : ''}`
        : `${fmtDuration(d.waitedMin)} en ${where}: avisar al broker antes de las 2 h`,
    });
  }

  if (load.status !== 'planned') {
    if (!load.driver_id) alerts.push({ code: 'no_driver', label: 'Sin driver asignado' });
    else if (!load.truck_id) alerts.push({ code: 'no_truck', label: 'Sin camión asignado' });
    if (opts.stopsWithCoords === 0) alerts.push({ code: 'no_stop_coords', label: 'Paradas sin ubicación en el mapa' });
  }

  return alerts;
}

const fmtDay = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'short', day: 'numeric', month: 'short' });

const fmtHours = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} días` : `${Math.floor(h)} h`);

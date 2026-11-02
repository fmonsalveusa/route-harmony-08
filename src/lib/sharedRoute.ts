import { supabase } from '@/integrations/supabase/client';
import { mapboxGeocode, mapboxRouteWithLegs } from '@/lib/mapConfig';

/**
 * Cargas parciales: cuando varias cargas del mismo camión se cruzan en días, el camión
 * hace un solo recorrido. Se arma esa ruta (desde la última entrega de la carga anterior,
 * pickups y entregas en el orden más corto que respete el orden de cada carga), se mide
 * con Mapbox y se reparte entre las cargas según sus millas cargadas.
 * El resultado se guarda en loads.shared_route_miles (NULL si la carga va sola).
 */

interface TruckLoad {
  id: string;
  reference_number: string;
  pickup_date: string | null;
  delivery_date: string | null;
  miles: number | null;
}

interface Stop {
  load_id: string;
  stop_order: number;
  address: string;
  lat: number | null;
  lng: number | null;
}

type Point = [number, number];

const day = (d: string | null) => (d || '').split('T')[0];
const spanOf = (l: TruckLoad) => {
  const start = day(l.pickup_date);
  const end = day(l.delivery_date);
  return start ? { start, end: end && end >= start ? end : start } : null;
};

/** Distancia en línea recta (millas) — solo para elegir el orden de las paradas */
function crow(a: Point, b: Point): number {
  const R = 3958.8, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Orden más corto que intercala las paradas de cada carga sin cambiar su orden interno */
function bestOrder(start: Point | null, sequences: Point[][]): Point[] {
  let best: Point[] = sequences.flat();
  let bestCost = Infinity;
  let explored = 0;
  const idx = sequences.map(() => 0);
  const path: Point[] = [];
  const walk = (cost: number) => {
    if (cost >= bestCost || explored > 20000) return;
    if (path.length === best.length) { bestCost = cost; best = [...path]; return; }
    explored++;
    for (let i = 0; i < sequences.length; i++) {
      if (idx[i] >= sequences[i].length) continue;
      const p = sequences[i][idx[i]];
      const prev = path.length ? path[path.length - 1] : start;
      idx[i]++; path.push(p);
      walk(cost + (prev ? crow(prev, p) : 0));
      path.pop(); idx[i]--;
    }
  };
  walk(0);
  return best;
}

async function pointOf(s: Stop): Promise<Point | null> {
  if (s.lat != null && s.lng != null) return [Number(s.lat), Number(s.lng)];
  return s.address ? mapboxGeocode(s.address) : null;
}

/** Recalcula y guarda las millas compartidas del grupo de la carga. Devuelve true si cambió algo. */
export async function refreshSharedRouteMiles(loadId: string): Promise<boolean> {
  const { data: self } = await supabase
    .from('loads').select('id, truck_id, status, shared_route_miles').eq('id', loadId).maybeSingle();
  if (!self) return false;
  const current = (self as any).shared_route_miles as number | null;

  const clear = async () => {
    if (current == null) return false;
    await supabase.from('loads').update({ shared_route_miles: null } as any).eq('id', loadId);
    return true;
  };
  if (!self.truck_id || ['cancelled', 'tonu'].includes(self.status)) return clear();

  const { data: rows } = await (supabase
    .from('loads')
    .select('id, reference_number, pickup_date, delivery_date, miles') as any)
    .eq('truck_id', self.truck_id)
    .not('status', 'in', '(cancelled,tonu)')
    .gte('pickup_date', '2026-08-01');
  const loads = ((rows as any[]) || []) as TruckLoad[];

  // Grupo: cargas que se cruzan en días con esta, y las que se cruzan con esas
  const group = new Map<string, TruckLoad>();
  const me = loads.find(l => l.id === loadId);
  if (!me || !spanOf(me)) return clear();
  const queue = [me];
  while (queue.length) {
    const cur = queue.pop()!;
    if (group.has(cur.id)) continue;
    group.set(cur.id, cur);
    const s = spanOf(cur)!;
    for (const o of loads) {
      const os = spanOf(o);
      if (os && !group.has(o.id) && os.start <= s.end && s.start <= os.end) queue.push(o);
    }
  }
  if (group.size < 2) return clear();

  const members = [...group.values()];
  const groupStart = members.map(l => spanOf(l)!.start).sort()[0];

  // Punto de partida: la última entrega de la carga anterior del camión
  const previous = loads
    .filter(l => !group.has(l.id) && spanOf(l) && spanOf(l)!.end <= groupStart)
    .sort((a, b) => spanOf(b)!.end.localeCompare(spanOf(a)!.end))[0];

  const ids = [...members.map(l => l.id), ...(previous ? [previous.id] : [])];
  const { data: stopRows } = await supabase
    .from('load_stops').select('load_id, stop_order, address, lat, lng').in('load_id', ids).order('stop_order');
  const stops = ((stopRows as any[]) || []) as Stop[];

  let start: Point | null = null;
  if (previous) {
    const last = stops.filter(s => s.load_id === previous.id).pop();
    if (last) start = await pointOf(last);
  }

  const sequences: Point[][] = [];
  for (const l of members) {
    const pts: Point[] = [];
    for (const s of stops.filter(x => x.load_id === l.id)) {
      const p = await pointOf(s);
      if (p) pts.push(p);
    }
    if (pts.length) sequences.push(pts);
  }
  if (sequences.length < 2) return clear();

  const ordered = bestOrder(start, sequences);
  const route = await mapboxRouteWithLegs(start ? [start, ...ordered] : ordered);
  if (!route || route.totalDistanceMiles <= 0) return false;

  // Reparto según millas cargadas de cada carga
  const loaded = members.map(l => Math.max(0, Number(l.miles) || 0));
  const totalLoaded = loaded.reduce((a, b) => a + b, 0);
  let changed = false;
  for (let i = 0; i < members.length; i++) {
    const share = totalLoaded > 0 ? loaded[i] / totalLoaded : 1 / members.length;
    const miles = Math.round(route.totalDistanceMiles * share);
    const { data: before } = await supabase.from('loads').select('shared_route_miles').eq('id', members[i].id).maybeSingle();
    if (Number((before as any)?.shared_route_miles) !== miles) {
      await supabase.from('loads').update({ shared_route_miles: miles } as any).eq('id', members[i].id);
      changed = true;
    }
  }
  return changed;
}

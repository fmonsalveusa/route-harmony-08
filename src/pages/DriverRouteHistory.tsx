import { useState, useEffect, useMemo, useRef } from 'react';
import { useDrivers } from '@/hooks/useDrivers';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, MapPin } from 'lucide-react';
import {
  startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths, format
} from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PERIOD_OPTIONS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

const ROUTE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  let start: Date, end: Date;
  switch (period) {
    case 'last_week':
      start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      break;
    case 'this_month':
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case 'last_month':
      start = startOfMonth(subMonths(now, 1));
      end = endOfMonth(subMonths(now, 1));
      break;
    default: // this_week
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
  }
  return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
}

async function geocode(place: string): Promise<[number, number] | null> {
  const attempts = [place];
  const cleaned = place.replace(/\b(suite|ste|unit|apt|#)\s*\S+/gi, '').trim();
  if (cleaned !== place) attempts.push(cleaned);
  const parts = place.split(',');
  if (parts.length >= 2) attempts.push(parts.slice(-2).join(',').trim());
  for (const query of attempts) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {}
  }
  return null;
}

async function drivingRoute(coords: [number, number][]): Promise<[number, number][] | null> {
  if (coords.length < 2) return null;
  try {
    const str = coords.map(c => `${c[1]},${c[0]}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${str}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
  } catch {}
  return null;
}

function normalizeRouteGeometry(input: unknown): [number, number][] | null {
  if (!Array.isArray(input)) return null;
  const normalized = input.filter((p: any) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number')
    .map((p: any) => [p[0], p[1]] as [number, number]);
  return normalized.length >= 2 ? normalized : null;
}

interface LoadRow {
  id: string;
  reference_number: string;
  total_rate: number;
  miles: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  route_geometry: unknown;
}

interface StopRow {
  id: string;
  load_id: string;
  address: string;
  stop_type: string;
  stop_order: number;
  date: string | null;
  lat: number | null;
  lng: number | null;
}

const DriverRouteHistory = () => {
  const { drivers, loading: driversLoading } = useDrivers();
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [period, setPeriod] = useState('this_week');
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const activeDrivers = useMemo(() => drivers.filter(d => d.status !== 'inactive'), [drivers]);

  // Fetch loads for selected driver + period
  useEffect(() => {
    if (!selectedDriverId) { setLoads([]); setStops([]); return; }
    const { from, to } = getDateRange(period);
    let cancelled = false;

    const fetchData = async () => {
      setMapLoading(true);
      const { data: loadData } = await supabase
        .from('loads')
        .select('id, reference_number, total_rate, miles, pickup_date, delivery_date, route_geometry')
        .eq('driver_id', selectedDriverId)
        .neq('status', 'cancelled')
        .gte('pickup_date', from)
        .lte('pickup_date', to)
        .order('pickup_date');

      if (cancelled) return;
      const rows = (loadData || []) as unknown as LoadRow[];
      setLoads(rows);

      if (rows.length > 0) {
        const loadIds = rows.map(l => l.id);
        const { data: stopData } = await supabase
          .from('load_stops')
          .select('id, load_id, address, stop_type, stop_order, date, lat, lng')
          .in('load_id', loadIds)
          .order('stop_order');
        if (!cancelled) setStops((stopData || []) as unknown as StopRow[]);
      } else {
        setStops([]);
      }
      if (!cancelled) setMapLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedDriverId, period]);

  // KPIs
  const totalRevenue = useMemo(() => loads.reduce((s, l) => s + (l.total_rate || 0), 0), [loads]);
  const totalMiles = useMemo(() => loads.reduce((s, l) => s + (l.miles || 0), 0), [loads]);
  const rpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;

  // Render map
  useEffect(() => {
    if (!mapRef.current) return;

    // Cleanup previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.8283, -98.5795], 4);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    if (loads.length === 0 || mapLoading) return;

    let cancelled = false;

    const drawRoutes = async () => {
      const allBounds: L.LatLngExpression[] = [];
      let globalStopIndex = 1;

      // Sort loads by pickup_date, then delivery_date as tiebreaker
      const sortedLoads = [...loads].sort((a, b) => {
        const cmp = (a.pickup_date || '').localeCompare(b.pickup_date || '');
        if (cmp !== 0) return cmp;
        return (a.delivery_date || '').localeCompare(b.delivery_date || '');
      });

      let prevLastCoords: [number, number] | null = null;

      for (let li = 0; li < sortedLoads.length; li++) {
        if (cancelled) return;
        const load = sortedLoads[li];
        const color = ROUTE_COLORS[li % ROUTE_COLORS.length];
        const loadStops = stops
          .filter(s => s.load_id === load.id)
          .sort((a, b) => a.stop_order - b.stop_order);

        // Resolve stop coords
        const resolvedStops: { stop: StopRow; coords: [number, number] }[] = [];
        for (const stop of loadStops) {
          if (cancelled) return;
          let coords: [number, number] | null = null;
          if (stop.lat != null && stop.lng != null) {
            coords = [stop.lat, stop.lng];
          } else {
            coords = await geocode(stop.address);
          }
          if (coords) {
            resolvedStops.push({ stop, coords });
            allBounds.push(coords);
          }
        }

        // Draw deadhead connector from previous load's last stop
        if (prevLastCoords && resolvedStops.length > 0) {
          const firstCoords = resolvedStops[0].coords;
          const deadheadGeometry = await drivingRoute([prevLastCoords, firstCoords]);
          if (cancelled) return;
          const deadheadPath = deadheadGeometry || [prevLastCoords, firstCoords];
          L.polyline(deadheadPath, {
            color: '#9ca3af',
            weight: 2,
            opacity: 0.5,
            dashArray: '8 6',
          }).addTo(map).bindPopup('<span style="color:#666">Deadhead / Empty</span>');
        }

        // Draw route polyline
        const cachedRoute = normalizeRouteGeometry(load.route_geometry);
        let routeCoords = cachedRoute;
        if (!routeCoords && resolvedStops.length >= 2) {
          routeCoords = await drivingRoute(resolvedStops.map(s => s.coords));
        }
        if (cancelled) return;

        if (routeCoords && routeCoords.length >= 2) {
          L.polyline(routeCoords, { color, weight: 4, opacity: 0.8 }).addTo(map)
            .bindPopup(`<b>${load.reference_number}</b><br/>$${load.total_rate.toLocaleString()} · ${load.miles || 0} mi`);
          routeCoords.forEach(c => allBounds.push(c));
        } else if (resolvedStops.length >= 2) {
          // Fallback: straight line
          L.polyline(resolvedStops.map(s => s.coords), { color, weight: 3, opacity: 0.6, dashArray: '6 4' }).addTo(map);
        }

        // Numbered markers
        for (const rs of resolvedStops) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              background:${color};color:#fff;width:26px;height:26px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;font-weight:700;
              font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
            ">${globalStopIndex}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          L.marker(rs.coords, { icon }).addTo(map).bindPopup(
            `<div style="min-width:160px">
              <b>${load.reference_number}</b><br/>
              <span style="text-transform:capitalize">${rs.stop.stop_type}</span><br/>
              <span style="font-size:12px;color:#666">${rs.stop.address}</span><br/>
              ${rs.stop.date ? `<span style="font-size:12px">${format(new Date(rs.stop.date + 'T00:00:00'), 'MMM d, yyyy')}</span>` : ''}
            </div>`
          );
          globalStopIndex++;
        }

        // Track last stop coords for next deadhead connector
        if (resolvedStops.length > 0) {
          prevLastCoords = resolvedStops[resolvedStops.length - 1].coords;
        }
      }

      if (!cancelled && allBounds.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(allBounds as L.LatLngExpression[]).pad(0.1));
        } catch {}
      }
    };

    drawRoutes();
    return () => { cancelled = true; };
  }, [loads, stops, mapLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Driver Route History</h1>
        <div className="flex gap-2">
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Driver" />
            </SelectTrigger>
            <SelectContent>
              {activeDrivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedDriverId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            subtitle={`${loads.length} loads`}
          />
          <StatCard
            title="Total Loaded Miles"
            value={totalMiles.toLocaleString()}
            icon={MapPin}
            subtitle="miles"
          />
          <StatCard
            title="RPM"
            value={`$${rpm.toFixed(2)}`}
            icon={TrendingUp}
            subtitle="Revenue Per Mile"
          />
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full rounded-lg border shadow-sm bg-muted"
        style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}
      />

      {mapLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
};

export default DriverRouteHistory;

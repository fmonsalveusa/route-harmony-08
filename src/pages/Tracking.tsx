import { useState, useMemo, useEffect, useRef } from 'react';
import { ServiceTypeBadge } from '@/components/ServiceTypeBadge';
import { getLoadRoutes, saveLoadRoute } from '@/lib/loadRoute';
import { useLoads, DbLoad } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, MapPinOff, Package, Navigation, Clock, Search, ChevronRight, AlertTriangle, Eye, User, Users, Pencil, Loader2, Copy, Check, Download, ExternalLink, X, Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DriversTimelineCard } from '@/components/dashboard/DriversTimelineCard';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAPBOX_TILE_URL, MAPBOX_TILE_OPTIONS, mapboxGeocode, mapboxRoute } from '@/lib/mapConfig';
import { LoadStop } from '@/hooks/useLoadStops';
import { format, parseISO, isToday } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { formatPhone } from '@/lib/phoneUtils';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#5ee14c;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const deliveryIcon = new L.DivIcon({
  html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface LoadWithStops extends DbLoad {
  stops: LoadStop[];
  routeCoords: [number, number][];
}

function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1 });
  }, [center, zoom, map]);
  return null;
}

const statusColors: Record<string, string> = {
  dispatched: 'hsl(270,60%,50%)',
  in_transit: '#5ee14c',
  on_site_pickup: 'hsl(170,60%,40%)',
  picked_up: '#266aad',
  on_site_delivery: '#266aad',
};

const statusLabels: Record<string, string> = {
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  on_site_pickup: 'On Site - Pickup',
  picked_up: 'Picked Up',
  on_site_delivery: 'On Site - Delivery',
};

const formatCityState = (location: string) => {
  const parts = location.split(',').map(s => s.trim());
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return location;
};

/** Ubicación en vivo: actualizada hace menos de 30 min. Más de 24 h: no se muestra. */
const LIVE_LOCATION_MS = 30 * 60 * 1000;
const MAX_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;

const formatAge = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
};

const createTruckIcon = (heading?: number | null, live = true) => {
  const rotation = heading != null ? heading : 0;
  const style = live
    ? 'background:#266aad;animation:pulse 2s infinite;'
    : 'background:#9ca3af;opacity:.85;';
  return new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="width:28px;height:28px;border-radius:50%;${style}border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rotation}deg)">
          <path d="M12 2L19 21L12 17L5 21Z"/>
        </svg>
      </div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const emptyOriginIcon = new L.DivIcon({
  html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
});

/** Ruta guardada: lista de [lat, lng] (como la guarda el detalle de la carga) o GeoJSON con [lng, lat] */
function parseRouteGeometry(saved: unknown): [number, number][] {
  try {
    const geo = typeof saved === 'string' ? JSON.parse(saved) : saved;
    if (Array.isArray(geo)) {
      return geo
        .filter((p: any) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map((p: any) => [Number(p[0]), Number(p[1])] as [number, number]);
    }
    if (Array.isArray((geo as any)?.coordinates)) {
      return (geo as any).coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    }
  } catch { /* ignore */ }
  return [];
}

const manualLocationIcon = new L.DivIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
    <div style="width:24px;height:24px;border-radius:50%;background:hsl(38,92%,50%);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  </div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const Tracking = () => {
  const { loads } = useLoads();
  const { drivers, refetch: refetchDrivers } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const { role, profile } = useAuth();

  // If dispatcher role, find matching dispatcher ID by email
  const userDispatcherId = useMemo(() => {
    if (role !== 'dispatcher' || !profile?.email) return null;
    const match = dispatchers.find(d => d.email.toLowerCase() === profile.email.toLowerCase());
    return match?.id ?? null;
  }, [role, profile?.email, dispatchers]);

  const isDispatcher = role === 'dispatcher';

  // Set of driver IDs assigned to this dispatcher (null = no filter, show all)
  const dispatcherDriverIds = useMemo(() => {
    if (!userDispatcherId) return null;
    return new Set(drivers.filter(d => d.dispatcher_id === userDispatcherId).map(d => d.id));
  }, [userDispatcherId, drivers]);

  const [allStops, setAllStops] = useState<LoadStop[]>([]);
  const [loadRoutes, setLoadRoutes] = useState<Record<string, unknown>>({});
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dispatcherFilter, setDispatcherFilter] = useState<string>('all');

  // Default dispatcher filter para fmonsalve.usa@gmail.com ΓåÆ Francisco Monsalve
  useEffect(() => {
    if (profile?.email?.toLowerCase() === 'fmonsalve.usa@gmail.com' && dispatchers.length > 0) {
      const francisco = dispatchers.find(d => d.name?.toLowerCase().includes('francisco monsalve'));
      if (francisco) setDispatcherFilter(francisco.id);
    }
  }, [profile?.email, dispatchers]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(4);
  const [lastDeliveryStops, setLastDeliveryStops] = useState<Record<string, { address: string; lat: number; lng: number; date: string }>>({});
  const [copiedDriverId, setCopiedDriverId] = useState<string | null>(null);
  const [copiedInfoId, setCopiedInfoId] = useState<string | null>(null);
  // Para el check visual al copiar campos sueltos: guarda `${driverId}:${campo}`
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyField = (driverId: string, field: string, value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedField(`${driverId}:${field}`);
    setTimeout(() => setCopiedField(null), 1500);
  };
  const todayEastern = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: '2-digit', year: 'numeric' });
  const [copiedDate, setCopiedDate] = useState(false);
  const copyTodayDate = () => { navigator.clipboard.writeText(todayEastern); setCopiedDate(true); setTimeout(() => setCopiedDate(false), 1500); };
  const [selectedDriverLoad, setSelectedDriverLoad] = useState<{ driver: typeof drivers[0]; load: LoadWithStops | null; lastDelivered?: { address: string; date: string } } | null>(null);
  const navigate = useNavigate();

  // Estado de busqueda diaria por driver: 'searching' | 'ready' | 'standby'.
  // Si un driver no esta en el map, esta en standby default (auto, sin fila persistida).
  // 'standby' explicito = usuario lo marco a mano y NO debe ser sobrescrito por auto-sync.
  // Se comparte entre todos los dispatchers del tenant y se reinicia cada dia (por search_date).
  const [searchStatus, setSearchStatus] = useState<Record<string, 'searching' | 'ready' | 'standby'>>({});
  // IDs de drivers cuyo estado fue seteado manualmente hoy. El auto-sync los respeta.
  const [manualStatusIds, setManualStatusIds] = useState<Set<string>>(new Set());

  // Manual location dialog state
  const [editLocationDriver, setEditLocationDriver] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const handleSaveManualLocation = async () => {
    if (!editLocationDriver || !locationInput.trim()) return;
    setSavingLocation(true);
    try {
      const coords = await mapboxGeocode(locationInput.trim());
      if (!coords) {
        toast({ title: 'Location not found', description: 'Try a different address or city, state format.', variant: 'destructive' });
        setSavingLocation(false);
        return;
      }
      const [lat, lng] = coords;
      const displayName = locationInput.trim();

      await supabase.from('drivers' as any).update({
        manual_location_address: displayName,
        manual_location_lat: lat,
        manual_location_lng: lng,
      } as any).eq('id', editLocationDriver);

      toast({ title: 'Location updated' });
      setEditLocationDriver(null);
      setLocationInput('');
      // Refresh drivers
      refetchDrivers();
    } catch {
      toast({ title: 'Error updating location', variant: 'destructive' });
    }
    setSavingLocation(false);
  };

  // Driver live locations
  const [driverLocations, setDriverLocations] = useState<Array<{
    driver_id: string; lat: number; lng: number; speed: number | null; heading: number | null; updated_at: string;
  }>>([]);

  // Reloj de 1 minuto para que las ubicaciones pasen a "sin actualizar" sin recargar la página
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch driver locations + realtime
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('driver_locations').select('*');
      if (data) setDriverLocations(data as any);
    };
    fetchLocations();

    const channel = supabase
      .channel('driver-locations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        fetchLocations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch all stops for active loads
  const activeStatuses = ['dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];
  const activeLoads = useMemo(() => loads.filter(l => activeStatuses.includes(l.status)), [loads]);

  useEffect(() => {
    if (activeLoads.length === 0) return;
    const ids = activeLoads.map(l => l.id);
    supabase
      .from('load_stops')
      .select('*')
      .in('load_id', ids)
      .order('stop_order', { ascending: true })
      .then(({ data }) => {
        if (data) setAllStops(data as LoadStop[]);
      });
  }, [activeLoads.length]);

  // Rutas guardadas de las cargas activas (viven en su propia tabla)
  useEffect(() => {
    if (activeLoads.length === 0) { setLoadRoutes({}); return; }
    let cancelled = false;
    getLoadRoutes(activeLoads.map(l => l.id)).then(r => { if (!cancelled) setLoadRoutes(r); });
    return () => { cancelled = true; };
  }, [activeLoads.length]);

  // Build enriched loads with stops and route geometry
  const enrichedLoads: LoadWithStops[] = useMemo(() => {
    return activeLoads.map(load => {
      const stops = allStops.filter(s => s.load_id === load.id);
      let routeCoords: [number, number][] = [];
      const saved = loadRoutes[load.id];
      if (saved) routeCoords = parseRouteGeometry(saved);
      // Fallback: draw straight line between stops with coordinates
      if (routeCoords.length === 0) {
        const geoStops = stops.filter(s => s.lat && s.lng).sort((a, b) => a.stop_order - b.stop_order);
        if (geoStops.length >= 2) {
          routeCoords = geoStops.map(s => [s.lat!, s.lng!] as [number, number]);
        }
      }
      return { ...load, stops, routeCoords } as LoadWithStops;
    });
  }, [activeLoads, allStops, loadRoutes]);

  // Cargas sin ruta guardada: se calcula la ruta real por carretera (igual que el detalle de la carga) y se guarda
  const routingRef = useRef(new Set<string>());
  useEffect(() => {
    const pending = activeLoads.filter(l => !loadRoutes[l.id] && !routingRef.current.has(l.id));
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const load of pending) {
        const coords = allStops
          .filter(s => s.load_id === load.id && s.lat && s.lng)
          .sort((a, b) => a.stop_order - b.stop_order)
          .map(s => [s.lat!, s.lng!] as [number, number]);
        if (coords.length < 2) continue;
        routingRef.current.add(load.id);
        const route = await mapboxRoute(coords).catch(() => null);
        if (cancelled) { routingRef.current.delete(load.id); return; }
        if (!route || route.length < 2) continue;
        setLoadRoutes(prev => ({ ...prev, [load.id]: route }));
        saveLoadRoute(load.id, route);
      }
    })();
    return () => { cancelled = true; };
  }, [activeLoads, allStops, loadRoutes]);

  // Empty miles: desde donde sale vacío el driver hasta el primer pickup (línea punteada naranja)
  const [deadheads, setDeadheads] = useState<Record<string, { origin: string; coords: [number, number]; route: [number, number][] }>>({});
  const deadheadRef = useRef(new Map<string, string>());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const load of activeLoads) {
        const origin = (load as any).empty_miles_origin as string | null;
        const firstPickup = allStops
          .filter(s => s.load_id === load.id && s.stop_type === 'pickup' && s.lat && s.lng)
          .sort((a, b) => a.stop_order - b.stop_order)[0];
        if (!origin || !firstPickup) continue;
        const key = `${origin}|${firstPickup.lat},${firstPickup.lng}`;
        if (deadheadRef.current.get(load.id) === key) continue;
        deadheadRef.current.set(load.id, key);
        const coords = await mapboxGeocode(origin).catch(() => null);
        if (cancelled) { deadheadRef.current.delete(load.id); return; }
        if (!coords) continue;
        const pickup: [number, number] = [firstPickup.lat!, firstPickup.lng!];
        const route = (await mapboxRoute([coords, pickup]).catch(() => null)) ?? [coords, pickup];
        if (cancelled) { deadheadRef.current.delete(load.id); return; }
        setDeadheads(prev => ({ ...prev, [load.id]: { origin, coords, route } }));
      }
    })();
    return () => { cancelled = true; };
  }, [activeLoads, allStops]);

  // Geocode stops that don't have coordinates
  useEffect(() => {
    const stopsToGeocode = allStops.filter(s => !s.lat || !s.lng);
    if (stopsToGeocode.length === 0) return;

    let cancelled = false;
    const geocodeStops = async () => {
      const updated: LoadStop[] = [];
      for (const stop of stopsToGeocode) {
        if (cancelled) break;
        try {
          const coords = await mapboxGeocode(stop.address);
          if (coords) {
            const [lat, lng] = coords;
            await supabase.from('load_stops').update({ lat, lng }).eq('id', stop.id);
            updated.push({ ...stop, lat, lng });
          }
        } catch { /* ignore */ }
      }
      if (!cancelled && updated.length > 0) {
        setAllStops(prev => prev.map(s => {
          const u = updated.find(x => x.id === s.id);
          return u || s;
        }));
      }
    };
    geocodeStops();
    return () => { cancelled = true; };
  }, [allStops]);

  const availableDrivers = useMemo(() => {
    const effectiveDispatcherFilter = userDispatcherId ?? dispatcherFilter;
    return drivers
      .filter(d => d.status !== 'inactive')
      .filter(d => effectiveDispatcherFilter === 'all' || d.dispatcher_id === effectiveDispatcherFilter);
  }, [drivers, dispatcherFilter, userDispatcherId]);

  // Hoy y mañana en hora del Este, en el mismo formato que delivery_date (YYYY-MM-DD)
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const tomorrowET = (() => {
    const d = new Date(`${todayET}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  // IDs de drivers visibles seg├║n el filtro de dispatcher del dropdown (Next Plan),
  // combinado con el scope del rol. Se usa para sincronizar mapa, timeline y stats
  // con el mismo filtro que Next Plan.
  // - Si tu rol ya te limita (userDispatcherId), ese scope manda.
  // - Si eres admin y eliges un dispatcher en el dropdown, filtra por ese.
  // - 'all' = sin filtro extra.
  const scopedDriverIds = useMemo(() => {
    const effective = userDispatcherId ?? (dispatcherFilter !== 'all' ? dispatcherFilter : null);
    if (!effective) return null; // null = ver todos
    return new Set(drivers.filter(d => d.dispatcher_id === effective).map(d => d.id));
  }, [userDispatcherId, dispatcherFilter, drivers]);

  // Última ubicación de cada driver, para la línea de GPS de su tarjeta
  const locByDriver = useMemo(() => {
    const map: Record<string, (typeof driverLocations)[number]> = {};
    driverLocations.forEach(l => { map[l.driver_id] = l; });
    return map;
  }, [driverLocations]);

  // Para cada driver, la carga activa cuya delivery_date (o pickup_date si no hay) es la mas reciente/lejana
  const activeLoadByDriver = useMemo(() => {
    const map: Record<string, LoadWithStops> = {};
    enrichedLoads.forEach(load => {
      if (!load.driver_id) return;
      const loadDate = load.delivery_date || load.pickup_date || '';
      const existing = map[load.driver_id];
      if (!existing) {
        map[load.driver_id] = load;
      } else {
        const existingDate = existing.delivery_date || existing.pickup_date || '';
        if (loadDate > existingDate) map[load.driver_id] = load;
      }
    });
    return map;
  }, [enrichedLoads]);

  // Orden del Next Plan:
  //  1. Vacíos
  //  2. Cargados que entregan hoy
  //  3. El resto de los cargados, por fecha de entrega (los que se liberan antes, arriba)
  //  Pausados siempre al final. Dentro de cada grupo desempata Buscando → Listo → Standby.
  const sortedDrivers = useMemo(() => {
    const deliveryOf = (d: any) => {
      const load = activeLoadByDriver[d.id];
      return load ? (load.delivery_date || load.pickup_date || '').slice(0, 10) : null;
    };
    const group = (d: any) => {
      if (d.is_paused) return 3;
      const delivery = deliveryOf(d);
      if (delivery === null) return 0;
      return delivery === todayET ? 1 : 2;
    };
    const statusRank = (d: any) => {
      const s = searchStatus[d.id];
      return s === 'searching' ? 0 : s === 'ready' ? 1 : 2;
    };
    return [...availableDrivers].sort((a, b) =>
      group(a) - group(b) ||
      (group(a) === 2 ? (deliveryOf(a) || '').localeCompare(deliveryOf(b) || '') : 0) ||
      statusRank(a) - statusRank(b),
    );
  }, [availableDrivers, searchStatus, activeLoadByDriver, todayET]);

  // Driver tiene carga FUTURA (delivery > hoy). Solo se usa para el pre-mark inicial:
  // los que no tienen futura (empty o entrega hoy) arrancan en Buscando.
  const hasFutureLoadByDriver = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const map: Record<string, boolean> = {};
    enrichedLoads.forEach(load => {
      if (!load.driver_id) return;
      const deliveryDate = load.delivery_date || '';
      if (deliveryDate > today) map[load.driver_id] = true;
    });
    return map;
  }, [enrichedLoads]);

  // Firma de asignaciones activas (driver_id:load_id:delivery_date).
  // Cambia cuando se asigna, reasigna, cancela una carga, O cuando cambia la
  // delivery_date (importante porque afecta si la carga cuenta como "futura").
  // Se usa para disparar el auto-sync solo cuando hay un cambio real (no en cada render).
  const activeAssignmentsSignature = useMemo(() => {
    return enrichedLoads
      .filter(l => l.driver_id)
      .map(l => `${l.driver_id}:${l.id}:${l.delivery_date || ''}`)
      .sort()
      .join(',');
  }, [enrichedLoads]);

  // Ultima parada (stop_order mas alto) de una carga
  const getLastStop = (load: LoadWithStops): LoadStop | null => {
    if (load.stops.length === 0) return null;
    return [...load.stops].sort((a, b) => b.stop_order - a.stop_order)[0];
  };

  const extractCityState = (address: string): string => {
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const city = parts[parts.length - 2];
      const stateZip = parts[parts.length - 1];
      const state = stateZip.replace(/\d{5}(-\d{4})?/, '').trim();
      return state ? `${city}, ${state}` : city;
    }
    return address;
  };

  const handleExportNextPlan = () => {
    const rows = availableDrivers.map(driver => {
      const lastDel = lastDeliveryStops[driver.id];
      const activeLoad = activeLoadByDriver[driver.id];
      const activeLastStop = activeLoad ? getLastStop(activeLoad) : null;
      const displayInfo = activeLastStop
        ? { address: activeLastStop.address, date: activeLoad.delivery_date || activeLoad.pickup_date || '' }
        : lastDel
        ? { address: lastDel.address, date: lastDel.date }
        : null;

      const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);

      return {
        driver: driver.name,
        status: activeLoad ? 'LOADED' : 'EMPTY',
        location: (driver as any).manual_location_address
          ? (driver as any).manual_location_address
          : displayInfo
          ? extractCityState(displayInfo.address)
          : '',
        date: displayInfo?.date || '',
        dispatcher: dispatcher?.name || '',
        phone: driver.phone || '',
      };
    });

    const headers = ['Driver', 'Status', 'Location', 'Date', 'Dispatcher', 'Phone'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r =>
        [r.driver, r.status, r.location, r.date, r.dispatcher, r.phone]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `next-plan-${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fetch last delivery location solo para drivers sin carga activa
  useEffect(() => {
    const driversWithoutActive = availableDrivers.filter(d => !activeLoadByDriver[d.id]);
    if (driversWithoutActive.length === 0) { setLastDeliveryStops({}); return; }
    const driverIds = driversWithoutActive.map(d => d.id);

    // Get last delivered load per driver.
    // Desempate: cuando dos cargas comparten delivery_date (ej. dos entregas el mismo d├¡a),
    // gana la de created_at m├ís reciente ΓÇö la registrada despu├⌐s es la ├║ltima real.
    supabase
      .from('loads')
      .select('id, driver_id, delivery_date, destination, created_at')
      .in('driver_id', driverIds)
      .eq('status', 'delivered')
      .order('delivery_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(async ({ data: deliveredLoads }) => {
        if (!deliveredLoads || deliveredLoads.length === 0) return;

        // Get unique last load per driver
        const lastLoadByDriver: Record<string, typeof deliveredLoads[0]> = {};
        deliveredLoads.forEach(l => {
          if (l.driver_id && !lastLoadByDriver[l.driver_id]) {
            lastLoadByDriver[l.driver_id] = l;
          }
        });

        const loadIds = Object.values(lastLoadByDriver).map(l => l.id);
        const { data: stops } = await supabase
          .from('load_stops')
          .select('*')
          .in('load_id', loadIds)
          .eq('stop_type', 'delivery')
          .order('stop_order', { ascending: false });

        const result: Record<string, { address: string; lat: number; lng: number; date: string }> = {};
        for (const [driverId, load] of Object.entries(lastLoadByDriver)) {
          const deliveryStop = (stops || []).find(s => s.load_id === load.id && s.lat && s.lng);
          if (deliveryStop) {
            result[driverId] = {
              address: deliveryStop.address,
              lat: deliveryStop.lat!,
              lng: deliveryStop.lng!,
              date: load.delivery_date || '',
            };
          } else {
            // No geocoded stop, still show address
            const anyStop = (stops || []).find(s => s.load_id === load.id);
            if (anyStop) {
              result[driverId] = { address: anyStop.address, lat: 0, lng: 0, date: load.delivery_date || '' };
            }
          }
        }
        setLastDeliveryStops(result);
      });
  }, [availableDrivers, activeLoadByDriver]);

  // Cargar el estado de b├║squeda de HOY (compartido entre dispatchers del tenant).
  // Adem├ís pre-marca en 'searching' a los drivers que entregan hoy y a├║n no tienen estado.
  // IMPORTANTE: solo corre cuando cambian los drivers, NO con cada update de loads/GPS
  // (si dependiera de `loads`, se re-ejecutar├¡a constantemente y pisar├¡a cambios manuales).
  const preMarkedRef = useRef(false);
  useEffect(() => {
    // Esperar a que carguen drivers Y loads antes del pre-mark, sino no podemos
    // distinguir "empty" de "todavia no llegaron los loads".
    if (!drivers.length || !loads.length || preMarkedRef.current) return;
    const today = new Date().toISOString().split('T')[0];

    (async () => {
      const { data, error } = await supabase
        .from('daily_search_status' as any)
        .select('driver_id, status, is_manual')
        .eq('search_date', today);

      if (error) { console.error('[Tracking] daily_search_status error:', error); return; }

      const map: Record<string, 'searching' | 'ready' | 'standby'> = {};
      const manualSet = new Set<string>();
      ((data as any) || []).forEach((r: any) => {
        map[r.driver_id] = r.status;
        if (r.is_manual) manualSet.add(r.driver_id);
      });
      setManualStatusIds(manualSet);

      // Pre-marcar como 'searching' a todo driver que NO tenga carga futura y no tenga estado guardado.
      // Esto cubre: (1) empty totales, (2) los que entregan hoy pero no tienen la siguiente.
      // Los que ya tienen carga futura quedan sin estado (= Standby por default).
      const driversWithFuture = new Set<string>();
      loads.forEach(l => {
        if (!l.driver_id || !l.delivery_date || l.status === 'cancelled') return;
        if (l.delivery_date > today) driversWithFuture.add(l.driver_id);
      });
      const toPreMark: string[] = [];
      drivers.forEach(d => {
        if (map[d.id]) return; // ya tiene estado persistido
        if ((d as any).is_paused) return; // driver pausado — no se auto-marca
        if (!driversWithFuture.has(d.id)) {
          map[d.id] = 'searching';
          toPreMark.push(d.id);
        }
      });

      setSearchStatus(map);
      preMarkedRef.current = true;

      if (toPreMark.length > 0) {
        const tenant_id = await getTenantId();
        const rows = toPreMark.map(driver_id => ({
          driver_id, search_date: today, status: 'searching', tenant_id, updated_by: profile?.id ?? null,
        }));
        await supabase.from('daily_search_status' as any).upsert(rows, { onConflict: 'driver_id,search_date,tenant_id' });
      }
    })();
  }, [drivers.length, loads.length, profile?.id]);

  // Cicla el estado de un driver: standby -> searching -> ready -> standby.
  // Cualquier cambio manual marca is_manual=true para que el auto-sync lo respete.
  // 'standby' manual se persiste (no se borra la fila) para no confundirse con auto standby.
  const cycleSearchStatus = async (driverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = searchStatus[driverId]; // undefined = auto standby
    const next: 'searching' | 'ready' | 'standby' =
      current === undefined || current === 'standby'
        ? 'searching'
        : current === 'searching'
        ? 'ready'
        : 'standby';

    // Optimista
    setSearchStatus(prev => ({ ...prev, [driverId]: next }));
    setManualStatusIds(prev => {
      const copy = new Set(prev);
      copy.add(driverId);
      return copy;
    });

    const today = new Date().toISOString().split('T')[0];
    const tenant_id = await getTenantId();

    await supabase.from('daily_search_status' as any).upsert(
      {
        driver_id: driverId,
        search_date: today,
        status: next,
        is_manual: true,
        tenant_id,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,search_date,tenant_id' }
    );
  };

  // Pausar/Reanudar driver (vacaciones o inactividad temporal).
  // Cuando esta pausado: no aparece en el search list, queda fijado en Standby,
  // el auto-sync lo ignora, y no se pre-marca al cargar la pagina.
  const togglePauseDriver = async (driverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    const currentlyPaused = !!(driver as any).is_paused;
    const willPause = !currentlyPaused;

    // Optimista: si vamos a pausar, forzamos standby local para reflejar visualmente.
    if (willPause) {
      setSearchStatus(prev => {
        const copy = { ...prev };
        delete copy[driverId]; // remover del map -> aparece como Standby por default
        return copy;
      });
      setManualStatusIds(prev => {
        const copy = new Set(prev);
        copy.delete(driverId);
        return copy;
      });
      // Borrar la fila del dia por si tenia estado manual/auto
      const today = new Date().toISOString().split('T')[0];
      const tenant_id = await getTenantId();
      await supabase.from('daily_search_status' as any)
        .delete()
        .eq('driver_id', driverId)
        .eq('search_date', today)
        .eq('tenant_id', tenant_id);
    }

    const { error } = await supabase.from('drivers' as any)
      .update({ is_paused: willPause } as any)
      .eq('id', driverId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: willPause ? `${driver.name} pausado` : `${driver.name} reanudado` });
    refetchDrivers();
  };

  // Auto-sync Buscando <-> Listo segun CARGA FUTURA (delivery > hoy):
  // - 'searching' + tiene carga futura -> 'ready'.
  // - 'ready' + no tiene carga futura -> 'searching'.
  // Una carga que entrega HOY NO cuenta — el driver sigue buscando la siguiente.
  // Corre siempre que cambie la firma de asignaciones (incluye la carga inicial,
  // para corregir estados stale de la DB).
  const prevAssignmentsRef = useRef<string>('');
  useEffect(() => {
    if (!preMarkedRef.current) return;
    if (prevAssignmentsRef.current === activeAssignmentsSignature) return;
    prevAssignmentsRef.current = activeAssignmentsSignature;

    const updates: Array<{ driver_id: string; newStatus: 'searching' | 'ready' }> = [];
    Object.entries(searchStatus).forEach(([driverId, status]) => {
      // Cualquier cambio manual se respeta — el usuario tiene la ultima palabra por el dia.
      // Al pasar la medianoche (nuevo search_date) los drivers vuelven al modo auto.
      if (manualStatusIds.has(driverId)) return;
      // Driver pausado (vacaciones/inactivo temporal) — no se toca desde el auto-sync.
      const driver = drivers.find(d => d.id === driverId);
      if ((driver as any)?.is_paused) return;
      // Listo = tiene carga FUTURA (delivery > hoy). Una carga que entrega HOY
      // no cuenta como cubierto — el driver sigue buscando la siguiente.
      const hasFuture = !!hasFutureLoadByDriver[driverId];
      if (status === 'searching' && hasFuture) {
        updates.push({ driver_id: driverId, newStatus: 'ready' });
      } else if (status === 'ready' && !hasFuture) {
        updates.push({ driver_id: driverId, newStatus: 'searching' });
      }
    });

    if (updates.length === 0) return;

    setSearchStatus(prev => {
      const copy = { ...prev };
      updates.forEach(u => { copy[u.driver_id] = u.newStatus; });
      return copy;
    });

    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const tenant_id = await getTenantId();
      const rows = updates.map(u => ({
        driver_id: u.driver_id,
        search_date: today,
        status: u.newStatus,
        tenant_id,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('daily_search_status' as any).upsert(rows, { onConflict: 'driver_id,search_date,tenant_id' });
    })();
  }, [activeAssignmentsSignature, hasFutureLoadByDriver, searchStatus, manualStatusIds, profile?.id]);

  // Contadores para el header
  const searchingCount = Object.values(searchStatus).filter(s => s === 'searching').length;
  const readyCount = Object.values(searchStatus).filter(s => s === 'ready').length;

  // Filter loads ΓÇö respeta el scope de rol y el filtro de dispatcher del dropdown
  const filteredLoads = useMemo(() => {
    return enrichedLoads.filter(l => {
      // Scope por dispatcher (rol o dropdown): solo cargas de esos drivers
      if (scopedDriverIds && (!l.driver_id || !scopedDriverIds.has(l.driver_id))) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (search) {
        const term = search.toLowerCase();
        const driver = drivers.find(d => d.id === l.driver_id);
        const truck = trucks.find(t => t.id === l.truck_id);
        const haystack = `${l.reference_number} ${l.origin} ${l.destination} ${l.broker_client || ''} ${driver?.name || ''} ${truck?.unit_number || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [enrichedLoads, statusFilter, search, drivers, trucks, scopedDriverIds]);

  const selectedLoad = enrichedLoads.find(l => l.id === selectedLoadId);

  // Stats ΓÇö filtered by dispatcher scope (rol o dropdown)
  const scopedActiveLoads = scopedDriverIds
    ? activeLoads.filter(l => l.driver_id && scopedDriverIds.has(l.driver_id))
    : activeLoads;
  const scopedAllLoads = scopedDriverIds
    ? loads.filter(l => l.driver_id && scopedDriverIds.has(l.driver_id))
    : loads;
  const inTransitCount = scopedActiveLoads.filter(l => l.status === 'in_transit').length;
  const dispatchedCount = scopedActiveLoads.filter(l => l.status === 'dispatched').length;
  const deliveriesToday = scopedAllLoads.filter(l => l.delivery_date && isToday(parseISO(l.delivery_date)) && l.status !== 'cancelled').length;

  const copyDriverInfo = (driver: typeof drivers[0]) => {
    const truck = trucks.find(t => t.id === driver.truck_id);
    const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);
    const truckType = truck?.truck_type || '';
    const isHotshot = truckType.toLowerCase().includes('hotshot');

    const truckLines = isHotshot
      ? `Truck #: ${truck?.unit_number || ''}\nTruck Type: Hotshot\nTrailer#: ${truck?.trailer_number || ''}\nTrailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}\nTruck Type: Box Truck\nTrailer#: ${truck?.trailer_number || ''}\nBack Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

    const truckHtmlLines = isHotshot
      ? `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Hotshot<br>Trailer#: ${truck?.trailer_number || ''}<br>Trailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Box Truck<br>Trailer#: ${truck?.trailer_number || ''}<br>Back Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

    const plain = `*Driver Info:*\nDriver Name: ${driver.name}\nPhone Number: ${formatPhone(driver.phone)}\n\n*Truck Info:*\n${truckLines}\n\n*Dispatcher Info:*\nDispatcher Name: ${dispatcher?.name || ''}\nDispatcher Phone Number: ${formatPhone(dispatcher?.phone)}\n\nETA to Pick up: `;
    const html = `<b>Driver Info:</b><br>Driver Name: ${driver.name}<br>Phone Number: ${formatPhone(driver.phone)}<br><br><b>Truck Info:</b><br>${truckHtmlLines}<br><br><b>Dispatcher Info:</b><br>Dispatcher Name: ${dispatcher?.name || ''}<br>Dispatcher Phone Number: ${formatPhone(dispatcher?.phone)}<br><br>ETA to Pick up: `;

    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
    } catch {
      navigator.clipboard.writeText(plain);
    }
    toast({ title: 'Copied to clipboard' });
  };

  const handleSelectLoad = (load: LoadWithStops) => {
    setSelectedLoadId(load.id);
    // Find center from stops or route
    if (load.routeCoords.length > 0) {
      const mid = load.routeCoords[Math.floor(load.routeCoords.length / 2)];
      setMapCenter(mid);
      setMapZoom(7);
    } else if (load.stops.length > 0) {
      const s = load.stops.find(s => s.lat && s.lng);
      if (s) {
        setMapCenter([s.lat!, s.lng!]);
        setMapZoom(7);
      }
    }
  };

  // Modal de detalle de carga
  const LoadDetailModal = () => {
    if (!selectedDriverLoad) return null;
    const { driver, load, lastDelivered } = selectedDriverLoad;
    const truck = trucks.find(t => t.id === driver.truck_id);
    const rpm = load && load.miles && Number(load.miles) > 0
      ? (Number(load.total_rate) / Number(load.miles)).toFixed(2)
      : null;
    const rpmColor = rpm
      ? Number(rpm) >= 1.90 ? 'text-green-600' : Number(rpm) >= 1.60 ? 'text-amber-500' : 'text-red-500'
      : '';

    return (
      <Dialog open={!!selectedDriverLoad} onOpenChange={() => setSelectedDriverLoad(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {driver.name}
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${load ? 'bg-[hsl(152,60%,40%)]' : 'bg-[hsl(25,95%,53%)]'}`}>
                {load ? 'LOADED' : 'EMPTY'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {load ? (
            <div className="space-y-4">
              {/* Load # y Broker */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Load #</p>
                  <p className="text-lg font-bold text-primary">{load.reference_number}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Broker</p>
                  <p className="text-sm font-semibold truncate">{load.broker_client || 'ΓÇö'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Truck</p>
                  <p className="text-sm font-semibold">{truck ? `Unit #${truck.unit_number}` : 'ΓÇö'}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-base font-bold text-[hsl(152,60%,35%)]">{load.total_rate ? `$${Number(load.total_rate).toLocaleString()}` : 'ΓÇö'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="text-base font-bold">{load.weight ? `${Number(load.weight).toLocaleString()} lbs` : 'ΓÇö'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Empty Miles</p>
                  <p className="text-base font-bold">{load.empty_miles ? Number(load.empty_miles).toLocaleString() : 'ΓÇö'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Miles</p>
                  <p className="text-base font-bold">{load.miles ? Number(load.miles).toLocaleString() : 'ΓÇö'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">RPM</p>
                  <p className={`text-base font-bold ${rpmColor}`}>{rpm ? `$${rpm}` : 'ΓÇö'}</p>
                </div>
              </div>

              {/* Paradas */}
              {load.stops.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Route & Stops</p>
                  <div className="space-y-0">
                    {[...load.stops].sort((a, b) => a.stop_order - b.stop_order).map((stop, i) => (
                      <div key={stop.id} className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${
                            stop.stop_type === 'pickup' ? 'bg-blue-500' :
                            stop.stop_type === 'delivery' ? 'bg-green-500' : 'bg-amber-400'
                          }`} />
                          {i < load.stops.length - 1 && <div className="w-px h-5 bg-border" />}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{stop.stop_type}</p>
                          <p className="text-sm font-medium leading-tight">{stop.address}</p>
                          {stop.date && (
                            <p className="text-xs text-muted-foreground">{format(parseISO(stop.date), 'MMM dd, yyyy')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setSelectedDriverLoad(null);
                    navigate('/loads');
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Full Load
                </Button>
                {(load as any).rate_confirmation_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => window.open((load as any).rate_confirmation_url, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Rate Confirmation
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No active load.</p>
              {lastDelivered && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Last Delivery</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{lastDelivered.address}</p>
                      {lastDelivered.date && (
                        <p className="text-xs text-muted-foreground">{format(parseISO(lastDelivered.date), 'MMM dd, yyyy')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // Resumen de arriba: sale de los mismos drivers que muestra Next Plan
  const activeDrivers = availableDrivers.filter(d => !(d as any).is_paused);
  const summaryTiles = [
    { label: 'Drivers', value: availableDrivers.length, icon: Users, tint: 'bg-sky-100 text-sky-700' },
    { label: 'Loaded', value: activeDrivers.filter(d => activeLoadByDriver[d.id]).length, icon: Package, tint: 'bg-emerald-100 text-emerald-700' },
    { label: 'Empty', value: activeDrivers.filter(d => !activeLoadByDriver[d.id]).length, icon: User, tint: 'bg-orange-100 text-orange-700' },
    { label: 'Buscando', value: activeDrivers.filter(d => searchStatus[d.id] === 'searching').length, icon: Search, tint: 'bg-amber-100 text-amber-700' },
    {
      label: 'GPS en vivo',
      value: availableDrivers.filter(d => {
        const l = locByDriver[d.id];
        return l && nowTick - new Date(l.updated_at).getTime() <= LIVE_LOCATION_MS;
      }).length,
      icon: Navigation,
      tint: 'bg-blue-100 text-blue-700',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-header">Live Tracking</h1>
        <p className="page-description">Real-time fleet monitoring and load tracking</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryTiles.map(t => (
          <div key={t.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tint}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t.label}</p>
              <p className="text-xl font-semibold leading-tight">{t.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search loads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-full bg-card shadow-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-10 rounded-full bg-card shadow-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="on_site_pickup">On Site Pickup</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="on_site_delivery">On Site Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main layout: Map + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Side Panel - Next Plan */}
        {/* Mismo formato que la tarjeta Drivers Load Timeline: fondo blanco, borde y título text-base */}
        <Card className="flex flex-col overflow-hidden h-[1040px] lg:row-span-2 lg:col-start-1">
          <CardHeader className="pb-2 px-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  NEXT PLAN ({availableDrivers.length})
                </CardTitle>
                <button type="button" onClick={copyTodayDate} title="Copy today's date" className="flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent transition-colors shrink-0">
                  {todayEastern}
                  {copiedDate ? <Check className="h-3 w-3 text-[#5ee14c]" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleExportNextPlan}
                >
                  <Download className="h-3 w-3" />
                  Export
                </Button>
              </div>
            </div>
            {!isDispatcher && (
              <Select value={dispatcherFilter} onValueChange={setDispatcherFilter}>
                <SelectTrigger className="w-full h-8 text-xs mt-2">
                  <SelectValue placeholder="All Dispatchers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dispatchers</SelectItem>
                  {dispatchers.filter(d => d.status === 'active').map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
            {availableDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No drivers</p>
              </div>
            ) : (
              sortedDrivers.map(driver => {
                const lastDel = lastDeliveryStops[driver.id];
                const activeLoad = activeLoadByDriver[driver.id];
                const activeLastStop = activeLoad ? getLastStop(activeLoad) : null;
                const displayInfo = activeLastStop
                  ? { address: activeLastStop.address, date: activeLoad.delivery_date || activeLoad.pickup_date || '', isActive: true }
                  : lastDel
                  ? { address: lastDel.address, date: lastDel.date, isActive: false }
                  : null;
                const sStatus = searchStatus[driver.id]; // undefined|'standby' = standby | 'searching' | 'ready'
                const isPaused = !!(driver as any).is_paused;
                const truck = trucks.find(t => t.id === driver.truck_id);
                const isCompanyDriver = (driver as any).service_type === 'company_driver';
                const loc = locByDriver[driver.id];
                const locAge = loc ? nowTick - new Date(loc.updated_at).getTime() : null;
                const locLive = locAge != null && locAge <= LIVE_LOCATION_MS;
                return (
                  <div
                    key={driver.id}
                    className={`flex overflow-hidden rounded-xl border shadow-sm transition-all cursor-pointer hover:shadow-md ${
                      // Fondo según la carga: verde si está cargado, naranja si está vacío
                      activeLoad ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'
                    } ${isPaused ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedDriverLoad({ driver, load: activeLoad || null, lastDelivered: lastDel ? { address: lastDel.address, date: lastDel.date } : undefined })}
                  >
                    {/* Franja vertical izquierda: LOADED / EMPTY, letra por letra */}
                    <div className={`flex w-8 shrink-0 items-center justify-center ${activeLoad ? 'bg-emerald-600' : 'bg-orange-500'}`}>
                      <span className="flex flex-col items-center text-[13px] font-bold leading-[1.15] text-white">
                        {(activeLoad ? 'LOADED' : 'EMPTY').split('').map((letter, i) => (
                          <span key={i}>{letter}</span>
                        ))}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                    {/* Línea 1: nombre, teléfono, carga y tipo de servicio */}
                    <div className="flex items-center gap-1.5 px-3 pt-2.5">
                      <p className="text-sm font-semibold truncate">{driver.name}</p>
                      <button
                        onClick={(e) => copyField(driver.id, 'name', driver.name, e)}
                        className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copiar Nombre"
                      >
                        {copiedField === `${driver.id}:name` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                      {driver.phone && (
                        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                          {driver.phone}
                          <button
                            onClick={(e) => copyField(driver.id, 'phone', driver.phone!, e)}
                            className="shrink-0 p-0.5 rounded hover:text-foreground hover:bg-muted transition-colors"
                            title="Copiar Teléfono"
                          >
                            {copiedField === `${driver.id}:phone` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </span>
                      )}
                      <ServiceTypeBadge
                        serviceType={(driver as any).service_type}
                        className="ml-auto shrink-0 !text-xs !px-2 !py-0.5 rounded-md"
                      />
                    </div>

                    {/* Línea 2: unidad y VIN */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pt-1 text-[11px] text-muted-foreground">
                      {truck?.unit_number && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {truck.unit_number}
                        </span>
                      )}
                      {isCompanyDriver && truck?.vin && (
                        <span className="flex items-center gap-0.5">
                          VIN {truck.vin}
                          <button
                            onClick={(e) => copyField(driver.id, 'vin', truck.vin!, e)}
                            className="shrink-0 p-0.5 rounded hover:text-foreground hover:bg-muted transition-colors"
                            title="Copiar VIN"
                          >
                            {copiedField === `${driver.id}:vin` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </span>
                      )}
                    </div>

                    {/* Línea 3: GPS — hace cuánto reportó y a qué velocidad */}
                    {(loc && locAge != null && locAge <= MAX_LOCATION_AGE_MS) || (driver as any).gps_background_granted === false ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-1 text-[11px]">
                        {loc && locAge != null && locAge <= MAX_LOCATION_AGE_MS && (
                          <span className={`flex items-center gap-1 ${locLive ? 'text-blue-700' : 'text-muted-foreground'}`}>
                            <span className={`h-2 w-2 rounded-full ${locLive ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`} />
                            GPS {formatAge(locAge)}
                            {locLive && loc.speed != null && ` · ${(loc.speed * 2.237).toFixed(0)} mph`}
                          </span>
                        )}
                        {(driver as any).gps_background_granted === false && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                            title="Sin permiso de ubicación en background — el GPS se apaga al cerrar la app"
                          >
                            <MapPinOff className="h-3 w-3" /> NO BG
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Ubicación manual */}
                    {(driver as any).manual_location_address && (
                      <div className="mx-3 mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Manual Location
                        </p>
                        <p className="text-sm font-semibold leading-tight">{(driver as any).manual_location_address}</p>
                      </div>
                    )}

                    {/* Próxima parada o última entrega */}
                    <div className="px-3 pt-2 text-xs text-muted-foreground">
                      {displayInfo ? (
                        <>
                          <p className="text-[10px] font-medium uppercase tracking-wide">
                            {displayInfo.isActive ? 'Next Stop' : 'Last Delivery'}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className={`h-3.5 w-3.5 shrink-0 ${displayInfo.isActive ? 'text-primary' : 'text-destructive'}`} />
                            <span className="text-base font-semibold leading-tight text-foreground">
                              {extractCityState(displayInfo.address)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(extractCityState(displayInfo.address));
                                setCopiedDriverId(driver.id);
                                setTimeout(() => setCopiedDriverId(null), 1500);
                              }}
                              className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copiar ciudad y estado"
                            >
                              {copiedDriverId === driver.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                            {displayInfo.isActive && (() => {
                              const delivery = (activeLoad?.delivery_date || '').slice(0, 10);
                              if (delivery === todayET) {
                                return <span className="shrink-0 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white" title="Entrega hoy">TODAY</span>;
                              }
                              if (delivery === tomorrowET) {
                                return <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white" title="Entrega mañana">TOMORROW</span>;
                              }
                              return null;
                            })()}
                          </div>
                          {displayInfo.date && (
                            <p className="text-[11px] mt-0.5">{format(parseISO(displayInfo.date), 'MMM dd, yyyy')}</p>
                          )}
                        </>
                      ) : (
                        !((driver as any).manual_location_address) && (
                          <p className="text-[10px] italic">No delivery history</p>
                        )
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 border-t mt-2.5 px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyDriverInfo(driver);
                          setCopiedInfoId(driver.id);
                          setTimeout(() => setCopiedInfoId(null), 1500);
                        }}
                        className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/70 text-green-600 transition-colors whitespace-nowrap flex items-center gap-1"
                        title="Copy Driver Info"
                      >
                        {copiedInfoId === driver.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy Info
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditLocationDriver(driver.id);
                          setLocationInput((driver as any).manual_location_address || '');
                        }}
                        className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/70 text-blue-600 transition-colors whitespace-nowrap flex items-center gap-1"
                        title="New Location"
                      >
                        <Pencil className="h-3 w-3" />
                        Location
                      </button>
                      <button
                        onClick={(e) => togglePauseDriver(driver.id, e)}
                        className={`shrink-0 p-1.5 rounded-md transition-colors ${
                          isPaused
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                        title={isPaused ? 'Reanudar driver' : 'Pausar driver (vacaciones/inactivo temporal)'}
                      >
                        {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                      </button>
                      <div className="flex-1" />
                      {isPaused ? (
                        <span className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-600 text-white whitespace-nowrap flex items-center gap-1">
                          <Pause className="h-3 w-3" /> PAUSADO
                        </span>
                      ) : (
                        <button
                          onClick={(e) => cycleSearchStatus(driver.id, e)}
                          className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1 ${
                            sStatus === 'ready'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : sStatus === 'searching'
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                          title={sStatus === 'ready' ? 'Listo — click para quitar' : sStatus === 'searching' ? 'Buscando — click para marcar Listo' : 'Standby — click para marcar Buscando'}
                        >
                          {sStatus === 'ready' ? <><Check className="h-3 w-3" /> Listo</>
                            : sStatus === 'searching' ? <><Search className="h-3 w-3" /> Buscando</>
                            : 'Standby'}
                        </button>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="lg:col-span-3 lg:col-start-2 overflow-hidden self-start rounded-xl shadow-sm">
          {/* isolate: la leyenda y las capas del mapa (z-index altos) quedan dentro del mapa y no por encima de las ventanas */}
          <div className="relative isolate h-[600px]">
            {/* Leyenda del mapa */}
            <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] text-gray-700 shadow-md">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#266aad]" /> GPS en vivo</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Sin actualizar</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(38,92%,50%)]" /> Manual</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#5ee14c]" /> Pickup</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Delivery</span>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution={MAPBOX_TILE_OPTIONS.attribution}
                url={MAPBOX_TILE_URL}
                tileSize={MAPBOX_TILE_OPTIONS.tileSize}
                zoomOffset={MAPBOX_TILE_OPTIONS.zoomOffset}
              />
              <MapFlyTo center={mapCenter} zoom={mapZoom} />

              {filteredLoads.map(load => {
                const isSelected = load.id === selectedLoadId;
                const color = isSelected ? '#266aad' : (statusColors[load.status] || '#888');
                const driver = drivers.find(d => d.id === load.driver_id);

                return (
                  <div key={load.id}>
                    {/* Route polyline */}
                    {load.routeCoords.length > 1 && (
                      <Polyline
                        positions={load.routeCoords}
                        pathOptions={{ color, weight: isSelected ? 5 : 3, opacity: isSelected ? 1 : 0.6 }}
                        eventHandlers={{ click: () => setSelectedLoadId(load.id) }}
                      >
                        <Popup>
                          <div style={{ minWidth: 220, fontFamily: 'inherit' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <strong style={{ fontSize: 13 }}>Load #{load.reference_number}</strong>
                              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, backgroundColor: color, color: '#fff', fontWeight: 600 }}>
                                {statusLabels[load.status] || load.status}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
                              <div>
                                <span style={{ color: '#888' }}>Driver</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>{driver?.name || 'ΓÇö'}</p>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>Truck</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>
                                  {load.truck_id ? `#${trucks.find(t => t.id === load.truck_id)?.unit_number || 'ΓÇö'}` : 'ΓÇö'}
                                </p>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>Rate</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>${load.total_rate.toLocaleString()}</p>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>RPM</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>
                                  {load.miles && load.miles > 0 ? `$${(load.total_rate / load.miles).toFixed(2)}` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>Miles</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>{load.miles ? load.miles.toLocaleString() : 'N/A'}</p>
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid #e5e5e5', marginTop: 8, paddingTop: 8, fontSize: 12 }}>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>P</span>
                                <div>
                                  <p style={{ fontWeight: 600, margin: 0 }}>{formatCityState(load.origin)}</p>
                                  <p style={{ color: '#888', margin: 0 }}>{load.pickup_date || 'ΓÇö'}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>D</span>
                                <div>
                                  <p style={{ fontWeight: 600, margin: 0 }}>{formatCityState(load.destination)}</p>
                                  <p style={{ color: '#888', margin: 0 }}>{load.delivery_date || 'ΓÇö'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Polyline>
                    )}
                    {/* Empty miles */}
                    {deadheads[load.id] && (
                      <>
                        <Polyline
                          positions={deadheads[load.id].route}
                          pathOptions={{ color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: isSelected ? 0.9 : 0.6 }}
                        />
                        <Marker position={deadheads[load.id].coords} icon={emptyOriginIcon}>
                          <Popup>
                            <div className="text-xs">
                              <strong>Empty Miles Origin</strong><br />
                              {deadheads[load.id].origin}
                              {load.empty_miles ? <><br />{Number(load.empty_miles).toLocaleString()} mi</> : null}
                            </div>
                          </Popup>
                        </Marker>
                      </>
                    )}
                    {/* Stop markers */}
                    {load.stops.filter(s => s.lat && s.lng).map(stop => (
                      <Marker
                        key={stop.id}
                        position={[stop.lat!, stop.lng!]}
                        icon={stop.stop_type === 'pickup' ? pickupIcon : deliveryIcon}
                      >
                        {driver && stop.stop_type === 'pickup' && (
                          <LeafletTooltip direction="top" offset={[0, -10]} permanent className="driver-name-tooltip">
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{driver.name}</span>
                          </LeafletTooltip>
                        )}
                        <Popup>
                          <div className="text-xs">
                            <strong>{load.reference_number}</strong>
                            <br />
                            {stop.stop_type === 'pickup' ? '≡ƒôª Pickup' : '≡ƒôì Delivery'}
                            <br />
                            {stop.address}
                            {driver && <><br />Driver: {driver.name}</>}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </div>
                );
              })}
              {/* Driver live location markers ΓÇö filtered by dispatcher scope (rol o dropdown) */}
              {driverLocations
                .filter(loc => !scopedDriverIds || scopedDriverIds.has(loc.driver_id))
                .map(loc => {
                const driver = drivers.find(d => d.id === loc.driver_id);
                // Drivers inactivos o ubicaciones de hace más de 24 h no se muestran
                if (!driver || driver.status === 'inactive') return null;
                const age = nowTick - new Date(loc.updated_at).getTime();
                if (age > MAX_LOCATION_AGE_MS) return null;
                const live = age <= LIVE_LOCATION_MS;
                return (
                  <Marker
                    key={`loc-${loc.driver_id}-${live ? 'live' : 'stale'}`}
                    position={[loc.lat, loc.lng]}
                    icon={createTruckIcon(loc.heading, live)}
                  >
                    <LeafletTooltip direction="top" offset={[0, -18]} permanent className="driver-name-tooltip">
                      <span style={{ fontSize: '11px', fontWeight: 600, color: live ? undefined : '#6b7280' }}>
                        {driver.name}{live ? '' : ` · ${formatAge(age)}`}
                      </span>
                    </LeafletTooltip>
                    <Popup>
                      <div className="text-xs">
                        <strong>{driver.name}</strong>
                        <br />{live ? 'GPS en vivo' : `Sin actualizar (${formatAge(age)})`}
                        {live && loc.speed != null && <><br />Speed: {(loc.speed * 2.237).toFixed(0)} mph</>}
                        <br /><span className="text-muted-foreground">Updated: {new Date(loc.updated_at).toLocaleTimeString()}</span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              {/* Manual location markers for available drivers */}
              {availableDrivers.filter(d => (d as any).manual_location_lat && (d as any).manual_location_lng).map(driver => (
                <Marker
                  key={`manual-${driver.id}`}
                  position={[(driver as any).manual_location_lat, (driver as any).manual_location_lng]}
                  icon={manualLocationIcon}
                >
                  <LeafletTooltip direction="top" offset={[0, -16]} permanent className="driver-name-tooltip">
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{driver.name}</span>
                  </LeafletTooltip>
                  <Popup>
                    <div className="text-xs">
                      <strong>{driver.name}</strong>
                      <br />≡ƒôì Manual Location
                      <br /><span className="text-muted-foreground">{(driver as any).manual_location_address}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Drivers Load Timeline ΓÇö debajo del mapa, misma columna */}
        <div className="lg:col-span-3 lg:col-start-2">
          <DriversTimelineCard
            loads={scopedAllLoads}
            drivers={scopedDriverIds ? drivers.filter(d => scopedDriverIds.has(d.id)) : drivers}
            trucks={trucks}
          />
        </div>
      </div>

      {/* Selected Load Detail */}
      {selectedLoad && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Load Details ΓÇö {selectedLoad.reference_number}
              </CardTitle>
              <StatusBadge status={selectedLoad.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Broker/Client</p>
                <p className="font-medium">{selectedLoad.broker_client || 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Driver</p>
                <p className="font-medium">{drivers.find(d => d.id === selectedLoad.driver_id)?.name || 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Truck</p>
                <p className="font-medium">{trucks.find(t => t.id === selectedLoad.truck_id)?.unit_number || 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Rate</p>
                <p className="font-medium">${selectedLoad.total_rate.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pickup Date</p>
                <p className="font-medium">{selectedLoad.pickup_date ? format(parseISO(selectedLoad.pickup_date), 'MMM dd, yyyy') : 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Delivery Date</p>
                <p className="font-medium">{selectedLoad.delivery_date ? format(parseISO(selectedLoad.delivery_date), 'MMM dd, yyyy') : 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Miles</p>
                <p className="font-medium">{selectedLoad.miles > 0 ? `${selectedLoad.miles} mi` : 'ΓÇö'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cargo Type</p>
                <p className="font-medium">{selectedLoad.cargo_type || 'ΓÇö'}</p>
              </div>
            </div>

            {/* Stops timeline */}
            {selectedLoad.stops.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Route Stops</p>
                <div className="space-y-2">
                  {selectedLoad.stops.map((stop, i) => (
                    <div key={stop.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${stop.stop_type === 'pickup' ? 'bg-[#5ee14c]' : 'bg-destructive'}`} />
                        {i < selectedLoad.stops.length - 1 && <div className="w-px h-6 bg-border" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{stop.stop_type === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                        <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                        {stop.distance_from_prev != null && stop.distance_from_prev > 0 && (
                          <p className="text-[10px] text-muted-foreground">{stop.distance_from_prev.toFixed(1)} mi from prev</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Manual Location Dialog */}
      <Dialog open={!!editLocationDriver} onOpenChange={(open) => { if (!open) { setEditLocationDriver(null); setLocationInput(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Set Driver Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter a city, state or full address. This will be used as the starting point for empty miles calculation on the next assigned load.</p>
            <Input
              placeholder="e.g. Dallas, TX"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveManualLocation()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditLocationDriver(null); setLocationInput(''); }}>Cancel</Button>
            <Button onClick={handleSaveManualLocation} disabled={savingLocation || !locationInput.trim()}>
              {savingLocation && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoadDetailModal />
    </div>
  );
};

export default Tracking;

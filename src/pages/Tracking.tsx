import { useState, useMemo, useEffect } from 'react';
import { useLoads, DbLoad } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Package, Navigation, Clock, Search, ChevronRight, AlertTriangle, Eye, User, Users, Pencil, Loader2, Copy, Check, Download, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DriversTimelineCard } from '@/components/dashboard/DriversTimelineCard';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAPBOX_TILE_URL, MAPBOX_TILE_OPTIONS, mapboxGeocode } from '@/lib/mapConfig';
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

const createTruckIcon = (heading?: number | null) => {
  const rotation = heading != null ? heading : 0;
  return new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#266aad;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite;">
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
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dispatcherFilter, setDispatcherFilter] = useState<string>('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(4);
  const [lastDeliveryStops, setLastDeliveryStops] = useState<Record<string, { address: string; lat: number; lng: number; date: string }>>({});
  const [copiedDriverId, setCopiedDriverId] = useState<string | null>(null);
  const [copiedInfoId, setCopiedInfoId] = useState<string | null>(null);
  const [selectedDriverLoad, setSelectedDriverLoad] = useState<{ driver: typeof drivers[0]; load: LoadWithStops | null; lastDelivered?: { address: string; date: string } } | null>(null);
  const navigate = useNavigate();

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

  // Build enriched loads with stops and route geometry
  const enrichedLoads: LoadWithStops[] = useMemo(() => {
    return activeLoads.map(load => {
      const stops = allStops.filter(s => s.load_id === load.id);
      let routeCoords: [number, number][] = [];
      if (load.route_geometry) {
        try {
          const geo = typeof load.route_geometry === 'string' ? JSON.parse(load.route_geometry) : load.route_geometry;
          if (geo?.coordinates) {
            routeCoords = geo.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          }
        } catch { /* ignore */ }
      }
      // Fallback: draw straight line between stops with coordinates
      if (routeCoords.length === 0) {
        const geoStops = stops.filter(s => s.lat && s.lng).sort((a, b) => a.stop_order - b.stop_order);
        if (geoStops.length >= 2) {
          routeCoords = geoStops.map(s => [s.lat!, s.lng!] as [number, number]);
        }
      }
      return { ...load, stops, routeCoords } as LoadWithStops;
    });
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

    // Get last delivered load per driver
    supabase
      .from('loads')
      .select('id, driver_id, delivery_date, destination')
      .in('driver_id', driverIds)
      .eq('status', 'delivered')
      .order('delivery_date', { ascending: false })
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

  // Filter loads — dispatchers only see loads of their assigned drivers
  const filteredLoads = useMemo(() => {
    return enrichedLoads.filter(l => {
      // Dispatcher isolation: only show loads from their drivers
      if (dispatcherDriverIds && (!l.driver_id || !dispatcherDriverIds.has(l.driver_id))) return false;
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
  }, [enrichedLoads, statusFilter, search, drivers, trucks, dispatcherDriverIds]);

  const selectedLoad = enrichedLoads.find(l => l.id === selectedLoadId);

  // Stats — filtered by dispatcher scope when applicable
  const scopedActiveLoads = dispatcherDriverIds
    ? activeLoads.filter(l => l.driver_id && dispatcherDriverIds.has(l.driver_id))
    : activeLoads;
  const scopedAllLoads = dispatcherDriverIds
    ? loads.filter(l => l.driver_id && dispatcherDriverIds.has(l.driver_id))
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
      ? `Truck #: ${truck?.unit_number || ''}\nTruck Type: Hotshot\nTrailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}\nTruck Type: Box Truck\nBack Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

    const truckHtmlLines = isHotshot
      ? `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Hotshot<br>Trailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Box Truck<br>Back Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

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
              {/* Load # */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Load #</p>
                  <p className="text-lg font-bold text-primary">{load.reference_number}</p>
                </div>
                {truck && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Truck</p>
                    <p className="text-sm font-semibold">Unit #{truck.unit_number}</p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Empty Miles</p>
                  <p className="text-base font-bold">{load.empty_miles ? Number(load.empty_miles).toLocaleString() : '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Miles</p>
                  <p className="text-base font-bold">{load.miles ? Number(load.miles).toLocaleString() : '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">RPM</p>
                  <p className={`text-base font-bold ${rpmColor}`}>{rpm ? `$${rpm}` : '—'}</p>
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
                          {stop.scheduled_date && (
                            <p className="text-xs text-muted-foreground">{format(parseISO(stop.scheduled_date), 'MMM dd, yyyy')}</p>
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
                    navigate(`/loads?load=${load.id}`);
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-header">Live Tracking</h1>
        <p className="page-description">Real-time fleet monitoring and load tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#5ee14c]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#5ee14c]/10">
              <Navigation className="h-5 w-5 text-[#5ee14c]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inTransitCount}</p>
              <p className="text-xs text-muted-foreground">In Transit</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(270,60%,50%)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(270,60%,50%)]/10">
              <Package className="h-5 w-5 text-[hsl(270,60%,50%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dispatchedCount}</p>
              <p className="text-xs text-muted-foreground">Dispatched</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{deliveriesToday}</p>
              <p className="text-xs text-muted-foreground">Deliveries Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search loads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9">
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
        <Card className="flex flex-col overflow-hidden h-[1040px] lg:row-span-2 lg:col-start-1">
          <CardHeader className="pb-2 px-3 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                NEXT PLAN ({availableDrivers.length})
              </CardTitle>
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
          <CardContent className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {availableDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No drivers</p>
              </div>
            ) : (
              availableDrivers.map(driver => {
                const lastDel = lastDeliveryStops[driver.id];
                const activeLoad = activeLoadByDriver[driver.id];
                const activeLastStop = activeLoad ? getLastStop(activeLoad) : null;
                const displayInfo = activeLastStop
                  ? { address: activeLastStop.address, date: activeLoad.delivery_date || activeLoad.pickup_date || '', isActive: true }
                  : lastDel
                  ? { address: lastDel.address, date: lastDel.date, isActive: false }
                  : null;
                return (
                  <div
                    key={driver.id}
                    className={`rounded-lg border border-border hover:border-primary/30 transition-all flex overflow-hidden cursor-pointer ${
                      activeLoad ? 'bg-[hsl(152,60%,40%)]/[0.03]' : 'bg-[hsl(25,95%,53%)]/[0.03]'
                    }`}
                    onClick={() => setSelectedDriverLoad({ driver, load: activeLoad || null, lastDelivered: lastDel ? { address: lastDel.address, date: lastDel.date } : undefined })}
                  >
                    {/* Badge vertical izquierdo */}
                    <div
                      className={`flex items-center justify-center w-7 shrink-0 ${
                        activeLoad ? 'bg-[hsl(152,60%,40%)]' : 'bg-[hsl(25,95%,53%)]'
                      }`}
                    >
                      <span className="text-white text-[9px] font-bold flex flex-col items-center gap-0">
                        {(activeLoad ? 'LOADED' : 'EMPTY').split('').map((letter, i) => (
                          <span key={i}>{letter}</span>
                        ))}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-full bg-[hsl(152,60%,40%)]/10">
                        <User className="h-3.5 w-3.5 text-[hsl(152,60%,40%)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{driver.name}</p>
                      </div>
                      {(() => {
                        const loc = driverLocations.find(dl => dl.driver_id === driver.id);
                        const isGpsActive = loc && (Date.now() - new Date(loc.updated_at).getTime()) < 5 * 60 * 1000;
                        return isGpsActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(152,60%,40%)]/15 text-[hsl(152,60%,40%)] text-[10px] font-semibold animate-pulse">
                            <Navigation className="h-3 w-3" />
                            GPS
                          </span>
                        ) : null;
                      })()}
                      {driver.phone && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{driver.phone}</span>
                      )}
                      {/* Copy Info button — misma línea que el nombre del driver */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyDriverInfo(driver);
                          setCopiedInfoId(driver.id);
                          setTimeout(() => setCopiedInfoId(null), 1500);
                        }}
                        className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-green-600 transition-colors whitespace-nowrap flex items-center gap-1"
                        title="Copy Driver Info"
                      >
                        {copiedInfoId === driver.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy Info
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {/* Manual location override */}
                      {(driver as any).manual_location_address && (
                        <div className="mt-1.5 pt-1.5 border-t">
                          <p className="text-[10px] font-medium text-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[hsl(38,92%,50%)]" />
                            Manual Location
                          </p>
                          <p className="text-base font-semibold leading-tight mt-0.5 pl-4">
                            {(driver as any).manual_location_address}
                          </p>
                        </div>
                      )}
                      {displayInfo ? (
                        <div className="mt-1.5 pt-1.5 border-t">
                          <p className="text-[10px] font-medium text-foreground">
                            {displayInfo.isActive ? 'Next Stop (Active Load)' : 'Last Delivery'}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className={`h-3 w-3 shrink-0 ${displayInfo.isActive ? 'text-primary' : 'text-destructive'}`} />
                            <span className="text-base font-semibold leading-tight">
                              {extractCityState(displayInfo.address)}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(extractCityState(displayInfo.address));
                                setCopiedDriverId(driver.id);
                                setTimeout(() => setCopiedDriverId(null), 1500);
                              }}
                              className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copiar ciudad y estado"
                            >
                              {copiedDriverId === driver.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                            <div className="flex-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditLocationDriver(driver.id);
                                setLocationInput((driver as any).manual_location_address || '');
                              }}
                              className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-blue-600 transition-colors whitespace-nowrap flex items-center gap-1"
                              title="New Location"
                            >
                              <Pencil className="h-3 w-3" />
                              New Location
                            </button>
                          </div>
                          {displayInfo.date && (
                            <p className="text-xs mt-0.5 opacity-70">{format(parseISO(displayInfo.date), 'MMM dd, yyyy')}</p>
                          )}
                        </div>
                      ) : (
                        !((driver as any).manual_location_address) && (
                          <p className="text-[10px] italic mt-1">No delivery history</p>
                        )
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
        <Card className="lg:col-span-3 lg:col-start-2 overflow-hidden self-start">
          <div className="h-[520px]">
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
                                <p style={{ fontWeight: 600, margin: 0 }}>{driver?.name || '—'}</p>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>Truck</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>
                                  {load.truck_id ? `#${trucks.find(t => t.id === load.truck_id)?.unit_number || '—'}` : '—'}
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
                                  <p style={{ color: '#888', margin: 0 }}>{load.pickup_date || '—'}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>D</span>
                                <div>
                                  <p style={{ fontWeight: 600, margin: 0 }}>{formatCityState(load.destination)}</p>
                                  <p style={{ color: '#888', margin: 0 }}>{load.delivery_date || '—'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Polyline>
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
                            {stop.stop_type === 'pickup' ? '📦 Pickup' : '📍 Delivery'}
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
              {/* Driver live location markers — filtered by dispatcher scope */}
              {driverLocations
                .filter(loc => !dispatcherDriverIds || dispatcherDriverIds.has(loc.driver_id))
                .map(loc => {
                const driver = drivers.find(d => d.id === loc.driver_id);
                if (!driver) return null;
                return (
                  <Marker
                    key={`loc-${loc.driver_id}`}
                    position={[loc.lat, loc.lng]}
                    icon={createTruckIcon(loc.heading)}
                  >
                    <LeafletTooltip direction="top" offset={[0, -18]} permanent className="driver-name-tooltip">
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>{driver.name}</span>
                    </LeafletTooltip>
                    <Popup>
                      <div className="text-xs">
                        <strong>{driver.name}</strong>
                        <br />📍 GPS Live
                        {loc.speed != null && <><br />Speed: {(loc.speed * 2.237).toFixed(0)} mph</>}
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
                      <br />📍 Manual Location
                      <br /><span className="text-muted-foreground">{(driver as any).manual_location_address}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Drivers Load Timeline — debajo del mapa, misma columna */}
        <div className="lg:col-span-3 lg:col-start-2">
          <DriversTimelineCard
            loads={scopedAllLoads}
            drivers={dispatcherDriverIds ? drivers.filter(d => dispatcherDriverIds.has(d.id)) : drivers}
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
                Load Details — {selectedLoad.reference_number}
              </CardTitle>
              <StatusBadge status={selectedLoad.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Broker/Client</p>
                <p className="font-medium">{selectedLoad.broker_client || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Driver</p>
                <p className="font-medium">{drivers.find(d => d.id === selectedLoad.driver_id)?.name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Truck</p>
                <p className="font-medium">{trucks.find(t => t.id === selectedLoad.truck_id)?.unit_number || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Rate</p>
                <p className="font-medium">${selectedLoad.total_rate.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pickup Date</p>
                <p className="font-medium">{selectedLoad.pickup_date ? format(parseISO(selectedLoad.pickup_date), 'MMM dd, yyyy') : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Delivery Date</p>
                <p className="font-medium">{selectedLoad.delivery_date ? format(parseISO(selectedLoad.delivery_date), 'MMM dd, yyyy') : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Miles</p>
                <p className="font-medium">{selectedLoad.miles > 0 ? `${selectedLoad.miles} mi` : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cargo Type</p>
                <p className="font-medium">{selectedLoad.cargo_type || '—'}</p>
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

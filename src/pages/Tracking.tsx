import { useState, useMemo, useEffect } from 'react';
import { useLoads, DbLoad } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Truck, Package, Navigation, Clock, Search, ChevronRight, AlertTriangle, Eye, User, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LoadStop } from '@/hooks/useLoadStops';
import { format, parseISO, isToday } from 'date-fns';

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
};

const Tracking = () => {
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();

  const [allStops, setAllStops] = useState<LoadStop[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dispatcherFilter, setDispatcherFilter] = useState<string>('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(4);
  const [lastDeliveryStops, setLastDeliveryStops] = useState<Record<string, { address: string; lat: number; lng: number; date: string }>>({});

  // Fetch all stops for active loads
  const activeStatuses = ['dispatched', 'in_transit'];
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
          const addr = encodeURIComponent(stop.address);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${addr}&countrycodes=us&limit=1`);
          const results = await res.json();
          if (results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            await supabase.from('load_stops').update({ lat, lng }).eq('id', stop.id);
            updated.push({ ...stop, lat, lng });
          }
          // Small delay to respect Nominatim rate limits
          await new Promise(r => setTimeout(r, 1100));
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

  // Available drivers: those with no active load (dispatched/in_transit)
  const driversWithActiveLoad = useMemo(() => {
    const activeDriverIds = new Set<string>();
    loads.forEach(l => {
      if (['dispatched', 'in_transit'].includes(l.status) && l.driver_id) {
        activeDriverIds.add(l.driver_id);
      }
    });
    return activeDriverIds;
  }, [loads]);

  const availableDrivers = useMemo(() => {
    return drivers
      .filter(d => d.status !== 'inactive' && !driversWithActiveLoad.has(d.id))
      .filter(d => dispatcherFilter === 'all' || d.dispatcher_id === dispatcherFilter);
  }, [drivers, driversWithActiveLoad, dispatcherFilter]);

  // Fetch last delivery location for available drivers
  useEffect(() => {
    if (availableDrivers.length === 0) return;
    const driverIds = availableDrivers.map(d => d.id);

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
  }, [availableDrivers.length]);

  // Filter loads
  const filteredLoads = useMemo(() => {
    return enrichedLoads.filter(l => {
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
  }, [enrichedLoads, statusFilter, search, drivers, trucks]);

  const selectedLoad = enrichedLoads.find(l => l.id === selectedLoadId);

  // Stats
  const inTransitCount = activeLoads.filter(l => l.status === 'in_transit').length;
  const dispatchedCount = activeLoads.filter(l => l.status === 'dispatched').length;
  const deliveriesToday = loads.filter(l => l.delivery_date && isToday(parseISO(l.delivery_date)) && l.status !== 'cancelled').length;

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

      {/* Main layout: Map + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="h-[520px]">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFlyTo center={mapCenter} zoom={mapZoom} />

              {filteredLoads.map(load => {
                const isSelected = load.id === selectedLoadId;
                const color = isSelected ? '#2563eb' : (statusColors[load.status] || '#888');
                const driver = drivers.find(d => d.id === load.driver_id);

                return (
                  <div key={load.id}>
                    {/* Route polyline */}
                    {load.routeCoords.length > 1 && (
                      <Polyline
                        positions={load.routeCoords}
                        pathOptions={{ color, weight: isSelected ? 5 : 3, opacity: isSelected ? 1 : 0.6 }}
                      />
                    )}
                    {/* Stop markers */}
                    {load.stops.filter(s => s.lat && s.lng).map(stop => (
                      <Marker
                        key={stop.id}
                        position={[stop.lat!, stop.lng!]}
                        icon={stop.stop_type === 'pickup' ? pickupIcon : deliveryIcon}
                      >
                        {driver && (
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
            </MapContainer>
          </div>
        </Card>

        {/* Side Panel - Active Loads */}
        <Card className="flex flex-col overflow-hidden h-[520px]">
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-sm font-semibold">Active Loads ({filteredLoads.length})</CardTitle>
            <div className="flex gap-2 mt-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filteredLoads.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No active loads</p>
              </div>
            )}
            {filteredLoads.map(load => {
              const driver = drivers.find(d => d.id === load.driver_id);
              const truck = trucks.find(t => t.id === load.truck_id);
              const isSelected = load.id === selectedLoadId;
              return (
                <div
                  key={load.id}
                  onClick={() => handleSelectLoad(load)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-semibold text-sm">{driver?.name || 'Unassigned'}</span>
                    <StatusBadge status={load.status} />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#5ee14c] shrink-0" />
                      <span className="truncate">{load.origin}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      <span className="truncate">{load.destination}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {truck?.unit_number || '—'}
                    </span>
                    <span>{load.reference_number}</span>
                    {load.miles > 0 && <span>{load.miles} mi</span>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Drivers Available ({availableDrivers.length})
              </CardTitle>
              <Select value={dispatcherFilter} onValueChange={setDispatcherFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All Dispatchers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dispatchers</SelectItem>
                  {dispatchers.filter(d => d.status === 'active').map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {availableDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No available drivers</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {availableDrivers.map(driver => {
                  const truck = trucks.find(t => t.id === driver.truck_id);
                  const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);
                  const lastDel = lastDeliveryStops[driver.id];
                  return (
                    <div key={driver.id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-full bg-[hsl(152,60%,40%)]/10">
                          <User className="h-3.5 w-3.5 text-[hsl(152,60%,40%)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{driver.name}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {lastDel ? (
                          <div className="mt-1.5 pt-1.5 border-t">
                            <p className="text-[10px] font-medium text-foreground">Last Delivery</p>
                            <div className="flex items-start gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-destructive" />
                              <span className="text-xs leading-tight">
                                {(() => {
                                  // Extract City, State from address
                                  const parts = lastDel.address.split(',').map(p => p.trim());
                                  if (parts.length >= 3) {
                                    // Format: "Street, City, State ZIP" or "City, State, ZIP"
                                    const stateZip = parts[parts.length - 1];
                                    const state = stateZip.replace(/\d{5}(-\d{4})?/, '').trim();
                                    const city = parts[parts.length - 2];
                                    return state ? `${city}, ${state}` : `${city}`;
                                  } else if (parts.length === 2) {
                                    return lastDel.address;
                                  }
                                  return lastDel.address;
                                })()}
                              </span>
                            </div>
                            {lastDel.date && (
                              <p className="text-xs mt-0.5 opacity-70">{format(parseISO(lastDel.date), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] italic mt-1">No delivery history</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
};

export default Tracking;

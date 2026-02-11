import { useEffect, useRef, useState } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { MapPin, Calendar, Weight, DollarSign, User, Truck, Route, Navigation, FileText, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatchers } from '@/hooks/useDispatchers';
import type { DbLoad } from '@/hooks/useLoads';
import { useLoadStops } from '@/hooks/useLoadStops';
import { supabase } from '@/integrations/supabase/client';
import { PodUploadSection } from '@/components/PodUploadSection';
import 'leaflet/dist/leaflet.css';

// Geocoding with progressive fallback: full address → without suite → city+state+zip
async function geocode(place: string): Promise<[number, number] | null> {
  const attempts = [place];
  // Remove suite/unit/apt info
  const noSuite = place.replace(/,?\s*(Suite|Ste|Unit|Apt|#)\s*\S*/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (noSuite !== place) attempts.push(noSuite);
  // Try just city, state, zip (last part after last comma group)
  const parts = place.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    attempts.push(parts.slice(-2).join(', ')); // e.g. "Middletown, PA 17057"
  }

  for (const query of attempts) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`);
      const data = await res.json();
      if (data.length > 0) {
        console.log(`[MAP] Geocoded "${query}" (from "${place}")`);
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch {}
  }
  console.warn(`[MAP] Failed to geocode: "${place}"`);
  return null;
}

// Get driving distance in miles between two points using OSRM
async function drivingDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return data.routes[0].distance * 0.000621371;
    }
  } catch {}
  return null;
}

// Get full route geometry for polyline
async function drivingRoute(coords: [number, number][]): Promise<[number, number][] | null> {
  if (coords.length < 2) return null;
  try {
    const waypoints = coords.map(c => `${c[1]},${c[0]}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    }
  } catch {}
  return null;
}

interface ResolvedStop {
  type: 'pickup' | 'delivery';
  address: string;
  coords: [number, number] | null;
  distanceFromPrev?: number;
}

interface LoadDetailPanelProps {
  load: DbLoad & { route_geometry?: [number, number][] | null };
  onMilesCalculated?: (loadId: string, miles: number, routeGeometry?: [number, number][]) => void;
}

export const LoadDetailPanel = ({ load, onMilesCalculated }: LoadDetailPanelProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const persistedRef = useRef(false);
  const [resolvedStops, setResolvedStops] = useState<ResolvedStop[]>([]);
  const [totalMiles, setTotalMiles] = useState<number>(Number(load.miles) || 0);
  const [emptyMiles, setEmptyMiles] = useState<number>(Number((load as any).empty_miles) || 0);
  const [emptyMilesOrigin, setEmptyMilesOrigin] = useState<string | null>((load as any).empty_miles_origin || null);
  const { stops: dbStops, loading: stopsLoading, updateStopGeodata } = useLoadStops(load.id);

  const { drivers } = useDrivers();
  const { dispatchers } = useDispatchers();
  const driver = drivers.find(d => d.id === load.driver_id);
  const dispatcher = dispatchers.find(d => d.id === load.dispatcher_id);
  const rpm = totalMiles > 0 ? Number(load.total_rate) / totalMiles : 0;

  const resolveDriverDocsUrl = async (url: string): Promise<string> => {
    if (!url) return '';

    const match = url.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
    if (match?.[1]) {
      let storagePath = match[1];
      try { storagePath = decodeURIComponent(storagePath); } catch {}

      const { data, error } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(storagePath, 3600);

      if (!error && data?.signedUrl) return data.signedUrl;
    }

    return url;
  };

  const openOriginalPdf = async () => {
    const url = await resolveDriverDocsUrl(load.pdf_url || '');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadOriginalPdf = async () => {
    const url = await resolveDriverDocsUrl(load.pdf_url || '');
    if (!url) return;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `RC_${load.reference_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Error downloading original PDF:', e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  const hasCachedRoute = load.route_geometry && Array.isArray(load.route_geometry) && load.route_geometry.length > 0;
  const hasCachedMiles = load.miles && Number(load.miles) > 0;

  // Check if all stops have cached geodata
  const allStopsCached = dbStops.length > 0 && dbStops.every(s => s.lat != null && s.lng != null);

  useEffect(() => {
    persistedRef.current = false;
    if (stopsLoading) return;

    let cancelled = false;

    // Build stop info from db or fallback
    const stopSources = dbStops.length > 0
      ? dbStops.map(s => ({ id: s.id, type: s.stop_type as 'pickup' | 'delivery', address: s.address, cachedLat: s.lat, cachedLng: s.lng, cachedDist: s.distance_from_prev }))
      : [
          { id: '', type: 'pickup' as const, address: load.origin, cachedLat: null, cachedLng: null, cachedDist: null },
          { id: '', type: 'delivery' as const, address: load.destination, cachedLat: null, cachedLng: null, cachedDist: null },
        ];

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // Helper: calculate empty miles (deadhead) from previous load's last delivery
      const calculateEmptyMiles = async (L: any, map: any, resolved: ResolvedStop[], bounds: [number, number][]) => {
        // Skip if already cached
        if (Number((load as any).empty_miles) > 0) {
          setEmptyMiles(Number((load as any).empty_miles));
          setEmptyMilesOrigin((load as any).empty_miles_origin || null);
          // Draw dashed line from empty_miles_origin to first pickup if we have coords
          const firstPickup = resolved.find(s => s.type === 'pickup' && s.coords);
          if (firstPickup?.coords && (load as any).empty_miles_origin) {
            const prevCoords = await geocode((load as any).empty_miles_origin);
            if (prevCoords) {
              const deadheadIcon = L.divIcon({
                html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
                className: '', iconSize: [24, 24], iconAnchor: [12, 12],
              });
              L.marker(prevCoords, { icon: deadheadIcon }).addTo(map).bindPopup(`<b>Empty Miles Origin</b><br/>${(load as any).empty_miles_origin}`);
              const deadheadRoute = await drivingRoute([prevCoords, firstPickup.coords]);
              if (deadheadRoute) {
                L.polyline(deadheadRoute, { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
              } else {
                L.polyline([prevCoords, firstPickup.coords], { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
              }
              bounds.push(prevCoords);
              map.fitBounds(bounds, { padding: [40, 40] });
            }
          }
          return;
        }

        // Need driver and pickup date to find previous load
        if (!load.driver_id || !load.pickup_date) return;

        // Find the driver's previous load
        const { data: prevLoads } = await supabase
          .from('loads')
          .select('id, delivery_date')
          .eq('driver_id', load.driver_id)
          .lt('delivery_date', load.pickup_date)
          .in('status', ['delivered', 'tonu'])
          .order('delivery_date', { ascending: false })
          .limit(1);

        if (!prevLoads || prevLoads.length === 0) return;

        // Get the last delivery stop of the previous load
        const { data: prevStops } = await supabase
          .from('load_stops')
          .select('*')
          .eq('load_id', prevLoads[0].id)
          .eq('stop_type', 'delivery')
          .order('stop_order', { ascending: false })
          .limit(1);

        if (!prevStops || prevStops.length === 0) return;

        const prevStop = prevStops[0];
        let prevCoords: [number, number] | null = null;
        if (prevStop.lat != null && prevStop.lng != null) {
          prevCoords = [prevStop.lat, prevStop.lng];
        } else {
          prevCoords = await geocode(prevStop.address);
        }

        if (!prevCoords) return;

        const firstPickup = resolved.find(s => s.type === 'pickup' && s.coords);
        if (!firstPickup?.coords) return;

        const dist = await drivingDistance(prevCoords[0], prevCoords[1], firstPickup.coords[0], firstPickup.coords[1]);
        if (dist === null) return;

        const roundedDist = Math.round(dist);
        setEmptyMiles(roundedDist);
        setEmptyMilesOrigin(prevStop.address);

        // Persist to database
        await supabase.from('loads').update({
          empty_miles: roundedDist,
          empty_miles_origin: prevStop.address,
        } as any).eq('id', load.id);

        // Draw dashed line on map
        const deadheadIcon = L.divIcon({
          html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
          className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        });
        L.marker(prevCoords, { icon: deadheadIcon }).addTo(map).bindPopup(`<b>Empty Miles Origin</b><br/>${prevStop.address}`);

        const deadheadRoute = await drivingRoute([prevCoords, firstPickup.coords]);
        if (deadheadRoute) {
          L.polyline(deadheadRoute, { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
        } else {
          L.polyline([prevCoords, firstPickup.coords], { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
        }
        bounds.push(prevCoords);
        map.fitBounds(bounds, { padding: [40, 40] });
      };

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

      const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

      const pickupIcon = L.divIcon({
        html: '<div style="background:hsl(152,60%,40%);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">P</div>',
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const deliveryIcon = L.divIcon({
        html: '<div style="background:hsl(0,72%,51%);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">D</div>',
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      });

      // FAST PATH: All geodata cached — no API calls needed
      if (allStopsCached && hasCachedRoute && hasCachedMiles) {
        console.log('[MAP] Using fully cached data');
        const cachedRoute = load.route_geometry as [number, number][];
        const resolved: ResolvedStop[] = stopSources.map(s => ({
          type: s.type, address: s.address,
          coords: [s.cachedLat!, s.cachedLng!] as [number, number],
          distanceFromPrev: s.cachedDist != null ? Math.round(Number(s.cachedDist)) : undefined,
        }));

        setResolvedStops(resolved);
        setTotalMiles(Number(load.miles));

        const bounds: [number, number][] = [];
        resolved.forEach(stop => {
          if (!stop.coords) return;
          const icon = stop.type === 'pickup' ? pickupIcon : deliveryIcon;
          L.marker(stop.coords, { icon }).addTo(map).bindPopup(`<b>${stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}</b><br/>${stop.address}`);
          bounds.push(stop.coords);
        });
        L.polyline(cachedRoute, { color: 'hsl(215,70%,50%)', weight: 3 }).addTo(map);
        if (bounds.length >= 2) map.fitBounds(bounds, { padding: [40, 40] });

        // Calculate empty miles (deadhead) for this load
        if (!cancelled) await calculateEmptyMiles(L, map, resolved, bounds);

        return;
      }

      // SLOW PATH: Calculate from scratch
      console.log('[MAP] Calculating from scratch');
      const coords = await Promise.all(
        stopSources.map(s =>
          s.cachedLat != null && s.cachedLng != null
            ? Promise.resolve([s.cachedLat, s.cachedLng] as [number, number])
            : geocode(s.address)
        )
      );
      if (cancelled) return;

      const resolved: ResolvedStop[] = stopSources.map((s, i) => ({
        type: s.type, address: s.address, coords: coords[i],
      }));

      let accumulatedMiles = 0;
      for (let i = 1; i < resolved.length; i++) {
        const prev = resolved[i - 1].coords;
        const curr = resolved[i].coords;
        if (prev && curr) {
          // Use cached distance if available
          if (stopSources[i].cachedDist != null) {
            resolved[i].distanceFromPrev = Math.round(Number(stopSources[i].cachedDist));
            accumulatedMiles += Number(stopSources[i].cachedDist);
          } else {
            const dist = await drivingDistance(prev[0], prev[1], curr[0], curr[1]);
            if (cancelled) return;
            if (dist !== null) {
              resolved[i].distanceFromPrev = Math.round(dist);
              accumulatedMiles += dist;
            }
          }
        }
      }

      const bounds: [number, number][] = [];
      resolved.forEach(stop => {
        if (!stop.coords) return;
        const icon = stop.type === 'pickup' ? pickupIcon : deliveryIcon;
        L.marker(stop.coords, { icon }).addTo(map).bindPopup(`<b>${stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}</b><br/>${stop.address}`);
        bounds.push(stop.coords);
      });

      let routeCoords: [number, number][] | null = null;
      if (bounds.length >= 2) {
        routeCoords = hasCachedRoute
          ? (load.route_geometry as [number, number][])
          : await drivingRoute(bounds);
        if (routeCoords && !cancelled) {
          L.polyline(routeCoords, { color: 'hsl(215,70%,50%)', weight: 3 }).addTo(map);
        } else {
          L.polyline(bounds, { color: 'hsl(215,70%,50%)', weight: 3, dashArray: '8 4' }).addTo(map);
        }
        map.fitBounds(bounds, { padding: [40, 40] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 10);
      }

      if (!cancelled) {
        setResolvedStops(resolved);
        const rounded = Math.round(accumulatedMiles);
        if (rounded > 0) setTotalMiles(rounded);

        // Persist geodata to load_stops for future fast loads
        for (let i = 0; i < resolved.length; i++) {
          const s = stopSources[i];
          const r = resolved[i];
          if (s.id && r.coords && s.cachedLat == null) {
            updateStopGeodata(s.id, r.coords[0], r.coords[1], r.distanceFromPrev);
          }
        }

        if (rounded > 0 && onMilesCalculated && !persistedRef.current) {
          persistedRef.current = true;
          onMilesCalculated(load.id, rounded, routeCoords || undefined);
        }

        // Calculate empty miles for slow path
        await calculateEmptyMiles(L, map, resolved, bounds);
      }
    };

    initMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id, stopsLoading, dbStops.length]);

  return (
    <div className="p-4 bg-muted/30 border-t animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Info */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Detalle de la Carga</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Dynamic stops display */}
            {resolvedStops.length > 0 ? (
              resolvedStops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <MapPin className={`h-3.5 w-3.5 ${stop.type === 'pickup' ? 'text-green-600' : 'text-red-600'}`} />
                  <div><span className="text-muted-foreground">{stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}:</span> <span className="font-medium">{stop.address}</span></div>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-green-600" />
                  <div><span className="text-muted-foreground">Pick Up:</span> <span className="font-medium">{load.origin}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-red-600" />
                  <div><span className="text-muted-foreground">Delivery:</span> <span className="font-medium">{load.destination}</span></div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Recogida:</span> <span className="font-medium">{formatDate(load.pickup_date)}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Entrega:</span> <span className="font-medium">{formatDate(load.delivery_date)}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Weight className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Peso:</span> <span className="font-medium">{load.weight ? `${load.weight.toLocaleString()} lbs` : '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{load.cargo_type || '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Route className="h-3.5 w-3.5 text-primary" />
              <div><span className="text-muted-foreground">Miles:</span> <span className="font-bold text-primary">{totalMiles > 0 ? totalMiles.toLocaleString() : '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Route className="h-3.5 w-3.5 text-amber-500" />
              <div>
                <span className="text-muted-foreground">Empty Miles:</span>{' '}
                <span className="font-bold text-amber-500">{emptyMiles > 0 ? emptyMiles.toLocaleString() : '—'}</span>
                {emptyMilesOrigin && <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">desde {emptyMilesOrigin}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <div><span className="text-muted-foreground">RPM:</span> <span className="font-bold text-primary">{rpm > 0 ? `$${rpm.toFixed(2)}` : '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Driver:</span> <span className="font-medium">{driver?.name || 'Sin asignar'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Dispatcher:</span> <span className="font-medium">{dispatcher?.name || '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Broker:</span> <span className="font-medium">{load.broker_client || '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Tarifa:</span> <span className="font-bold text-primary">${Number(load.total_rate).toLocaleString()}</span></div>
            </div>
          </div>

          {/* Stops / Route breakdown */}
          <div className="p-3 rounded-lg bg-card border text-sm">
            <h5 className="font-semibold mb-2 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" /> Ruta y Paradas
            </h5>
            {resolvedStops.length > 0 ? (
              <div className="space-y-2">
                {resolvedStops.map((stop, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${stop.type === 'pickup' ? 'bg-[hsl(152,60%,40%)]' : 'bg-[hsl(0,72%,51%)]'}`}>
                      {stop.type === 'pickup' ? 'P' : 'D'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{stop.address}</div>
                      <div className="text-muted-foreground text-xs">
                        {stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}
                        {stop.distanceFromPrev != null && (
                          <span className="ml-2 text-primary font-semibold">↳ {stop.distanceFromPrev.toLocaleString()} mi desde parada anterior</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {totalMiles > 0 && (
                  <div className="pt-2 border-t flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Distancia Total</span>
                    <span className="text-primary">{totalMiles.toLocaleString()} miles</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Calculando ruta...</p>
            )}
          </div>

          {/* PDF Document */}
          {load.pdf_url && (
            <div className="p-3 rounded-lg bg-card border text-sm">
              <h5 className="font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Documento Original (PDF)
              </h5>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    void openOriginalPdf();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ver PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    void downloadOriginalPdf();
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </Button>
              </div>
            </div>
          )}

          {/* POD Upload Section */}
          <PodUploadSection loadId={load.id} />
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border bg-card relative" style={{ minHeight: 280, zIndex: 0 }}>
          <div ref={mapRef} style={{ height: '100%', minHeight: 280, zIndex: 0 }} />
        </div>
      </div>
    </div>
  );
};

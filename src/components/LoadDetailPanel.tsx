import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { MapPin, Calendar, Weight, DollarSign, User, Truck, Route, Navigation, FileText, Download, ExternalLink, Pencil, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useTrucks } from '@/hooks/useTrucks';
import type { DbLoad } from '@/hooks/useLoads';
import { useLoadStops } from '@/hooks/useLoadStops';
import { supabase } from '@/integrations/supabase/client';
import { PodUploadSection } from '@/components/PodUploadSection';
import { PickupPicturesSection } from '@/components/PickupPicturesSection';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
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
  onLoadDataUpdated?: () => void;
}

function CopyLoadInfoButton({ load, totalMiles, emptyMiles, rpm, driver, dispatcher }: {
  load: DbLoad; totalMiles: number; emptyMiles: number; rpm: number;
  driver?: { name: string } | undefined; dispatcher?: { name: string } | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const lines = [
      `Broker: ${load.broker_client || '—'}`,
      `Pickup: ${formatDate(load.pickup_date)}`,
      `Delivery: ${formatDate(load.delivery_date)}`,
      `Weight: ${load.weight ? `${load.weight.toLocaleString()} lbs` : '—'}`,
      `Empty Miles: ${emptyMiles > 0 ? emptyMiles.toLocaleString() : '—'}`,
      `Loaded Miles: ${totalMiles > 0 ? totalMiles.toLocaleString() : '—'}`,
      `Rate: $${Number(load.total_rate).toLocaleString()}`,
      `RPM: $${rpm > 0 ? rpm.toFixed(2) : '—'}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-info/10 text-info hover:bg-info/20 transition-colors" title="Copy load info">
      {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
    </button>
  );
}

export const LoadDetailPanel = ({ load, onMilesCalculated, onLoadDataUpdated }: LoadDetailPanelProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const persistedRef = useRef(false);
  const [resolvedStops, setResolvedStops] = useState<ResolvedStop[]>([]);
  const [totalMiles, setTotalMiles] = useState<number>(Number(load.miles) || 0);
  const [emptyMiles, setEmptyMiles] = useState<number>(Number((load as any).empty_miles) || 0);
  const [emptyMilesOrigin, setEmptyMilesOrigin] = useState<string | null>((load as any).empty_miles_origin || null);
  const [editingEmptyOrigin, setEditingEmptyOrigin] = useState(false);
  const [customOriginInput, setCustomOriginInput] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { stops: dbStops, loading: stopsLoading, updateStopGeodata } = useLoadStops(load.id);

  // Sync local state when load prop changes (after refetch)
  useEffect(() => {
    setEmptyMiles(Number((load as any).empty_miles) || 0);
    setEmptyMilesOrigin((load as any).empty_miles_origin || null);
    setTotalMiles(Number(load.miles) || 0);
  }, [load.id, (load as any).empty_miles, (load as any).empty_miles_origin, load.miles]);

  const { drivers } = useDrivers();
  const { dispatchers } = useDispatchers();
  const { trucks } = useTrucks();
  const driver = drivers.find(d => d.id === load.driver_id);
  const dispatcher = dispatchers.find(d => d.id === load.dispatcher_id);
  const truck = trucks.find(t => t.id === load.truck_id);
  const rpm = totalMiles > 0 ? Number(load.total_rate) / totalMiles : 0;
  const truckType = (truck?.truck_type || '').toLowerCase();
  const isHotshot = truckType.includes('hotshot');
  const rpmColorClass = rpm <= 0 ? 'text-muted-foreground' : isHotshot
    ? (rpm >= 1.90 ? 'text-green-600' : rpm >= 1.60 ? 'text-amber-500' : 'text-red-600')
    : (rpm >= 1.70 ? 'text-green-600' : rpm >= 1.40 ? 'text-amber-500' : 'text-red-600');

  const handleRecalculateEmptyMiles = async () => {
    const trimmed = customOriginInput.trim();
    if (!trimmed) return;

    setRecalculating(true);
    try {
      const newCoords = await geocode(trimmed);
      if (!newCoords) {
        toast({ title: 'Error', description: 'No se pudo geocodificar la dirección ingresada', variant: 'destructive' });
        setRecalculating(false);
        return;
      }

      const firstPickup = resolvedStops.find(s => s.type === 'pickup' && s.coords);
      if (!firstPickup?.coords) {
        toast({ title: 'Error', description: 'No se encontró el primer pickup con coordenadas', variant: 'destructive' });
        setRecalculating(false);
        return;
      }

      const dist = await drivingDistance(newCoords[0], newCoords[1], firstPickup.coords[0], firstPickup.coords[1]);
      if (dist === null) {
        toast({ title: 'Error', description: 'No se pudo calcular la distancia', variant: 'destructive' });
        setRecalculating(false);
        return;
      }

      const rounded = Math.round(dist);

      // Persist to database first
      console.log('Updating empty miles in DB:', { id: load.id, empty_miles: rounded, empty_miles_origin: trimmed });
      const { error: updateError, data: updateData, count } = await supabase.from('loads').update({
        empty_miles: rounded,
        empty_miles_origin: trimmed,
      }).eq('id', load.id).select();

      console.log('Update result:', { error: updateError, data: updateData, count });

      if (updateError) {
        console.error('Error updating empty miles:', updateError);
        toast({ title: 'Error', description: 'No se pudo guardar en la base de datos', variant: 'destructive' });
        setRecalculating(false);
        return;
      }

      if (!updateData || updateData.length === 0) {
        console.error('No rows updated - possible RLS issue');
        toast({ title: 'Error', description: 'No se pudo actualizar la carga (permisos)', variant: 'destructive' });
        setRecalculating(false);
        return;
      }

      // Update local state after successful DB save
      setEmptyMiles(rounded);
      setEmptyMilesOrigin(trimmed);
      // Invalidate React Query cache so parent gets fresh data
      await queryClient.invalidateQueries({ queryKey: ['loads'] });
      onLoadDataUpdated?.();

      // Redraw map with new empty miles origin
      if (mapInstanceRef.current) {
        const L = (await import('leaflet')).default;
        const map = mapInstanceRef.current;

        // Remove existing empty miles layers and redraw
        map.eachLayer((layer: any) => {
          if (layer._popup?.getContent()?.includes?.('Empty Miles Origin')) {
            map.removeLayer(layer);
          }
          if (layer.options?.color === 'hsl(38,92%,50%)') {
            map.removeLayer(layer);
          }
        });

        const deadheadIcon = L.divIcon({
          html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
          className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        });
        L.marker(newCoords, { icon: deadheadIcon }).addTo(map).bindPopup(`<b>Empty Miles Origin</b><br/>${trimmed}`);

        const deadheadRoute = await drivingRoute([newCoords, firstPickup.coords]);
        if (deadheadRoute) {
          L.polyline(deadheadRoute, { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
        } else {
          L.polyline([newCoords, firstPickup.coords], { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
        }
      }

      setEditingEmptyOrigin(false);
      toast({ title: 'Empty miles actualizadas', description: `${rounded} mi desde ${trimmed}` });
    } catch (e) {
      console.error('Error recalculating empty miles:', e);
      toast({ title: 'Error', description: 'Error inesperado al recalcular', variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

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
        if (Number((load as any).empty_miles) > 0 || (load as any).empty_miles_origin) {
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

        // Check if driver has a manual location override
        const { data: driverData } = await supabase
          .from('drivers' as any)
          .select('manual_location_address, manual_location_lat, manual_location_lng')
          .eq('id', load.driver_id)
          .maybeSingle();

        const manualLoc = driverData as any;
        if (manualLoc?.manual_location_lat && manualLoc?.manual_location_lng && manualLoc?.manual_location_address) {
          // Use manual location as empty miles origin
          const prevCoords: [number, number] = [manualLoc.manual_location_lat, manualLoc.manual_location_lng];
          const firstPickup = resolved.find(s => s.type === 'pickup' && s.coords);
          if (!firstPickup?.coords) return;

          const dist = await drivingDistance(prevCoords[0], prevCoords[1], firstPickup.coords[0], firstPickup.coords[1]);
          if (dist === null) return;

          const roundedDist = Math.round(dist);
          setEmptyMiles(roundedDist);
          setEmptyMilesOrigin(manualLoc.manual_location_address);

          await supabase.from('loads').update({
            empty_miles: roundedDist,
            empty_miles_origin: manualLoc.manual_location_address,
          } as any).eq('id', load.id);
          onLoadDataUpdated?.();

          // Draw on map
          const deadheadIcon = L.divIcon({
            html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
            className: '', iconSize: [24, 24], iconAnchor: [12, 12],
          });
          L.marker(prevCoords, { icon: deadheadIcon }).addTo(map).bindPopup(`<b>Empty Miles Origin (Manual)</b><br/>${manualLoc.manual_location_address}`);
          const deadheadRoute = await drivingRoute([prevCoords, firstPickup.coords]);
          if (deadheadRoute) {
            L.polyline(deadheadRoute, { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
          } else {
            L.polyline([prevCoords, firstPickup.coords], { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
          }
          bounds.push(prevCoords);
          map.fitBounds(bounds, { padding: [40, 40] });

          // Clear manual location after use
          await supabase.from('drivers' as any).update({
            manual_location_address: null,
            manual_location_lat: null,
            manual_location_lng: null,
          } as any).eq('id', load.driver_id);
          return;
        }

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
        onLoadDataUpdated?.();

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
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">Load Detail</h4>
            <CopyLoadInfoButton load={load} totalMiles={totalMiles} emptyMiles={emptyMiles} rpm={rpm} driver={driver} dispatcher={dispatcher} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Dynamic stops display */}
            {resolvedStops.length > 0 ? (
              resolvedStops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <MapPin className={`h-3.5 w-3.5 ${stop.type === 'pickup' ? 'text-green-600' : 'text-red-600'}`} />
                  <div className="flex-1"><span className="text-muted-foreground">{stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}:</span> <span className="font-medium">{stop.address}</span></div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 p-1 rounded hover:bg-muted text-primary"
                    title="Navigate in Google Maps"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-green-600" />
                  <div className="flex-1"><span className="text-muted-foreground">Pick Up:</span> <span className="font-medium">{load.origin}</span></div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(load.origin)}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted text-primary"><Navigation className="h-3.5 w-3.5" /></a>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-red-600" />
                  <div className="flex-1"><span className="text-muted-foreground">Delivery:</span> <span className="font-medium">{load.destination}</span></div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(load.destination)}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted text-primary"><Navigation className="h-3.5 w-3.5" /></a>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Pickup:</span> <span className="font-medium">{formatDate(load.pickup_date)}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Delivery:</span> <span className="font-medium">{formatDate(load.delivery_date)}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Weight className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{load.weight ? `${load.weight.toLocaleString()} lbs` : '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{truck?.truck_type || '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Route className="h-3.5 w-3.5 text-primary" />
              <div><span className="text-muted-foreground">Miles:</span> <span className="font-bold text-primary">{totalMiles > 0 ? totalMiles.toLocaleString() : '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Route className="h-3.5 w-3.5 text-amber-500" />
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Empty Miles:</span>{' '}
                  <span className="font-bold text-amber-500">{emptyMiles > 0 ? emptyMiles.toLocaleString() : '—'}</span>
                  <Popover open={editingEmptyOrigin} onOpenChange={(open) => {
                    setEditingEmptyOrigin(open);
                    if (open) setCustomOriginInput(emptyMilesOrigin || '');
                  }}>
                    <PopoverTrigger asChild>
                      <button className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar origen de millas vacías">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Nuevo origen de millas vacías</p>
                        <Input
                          placeholder="Ej: Dallas, TX 75001"
                          value={customOriginInput}
                          onChange={(e) => setCustomOriginInput(e.target.value)}
                          className="text-xs h-8"
                          disabled={recalculating}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleRecalculateEmptyMiles(); }}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingEmptyOrigin(false)} disabled={recalculating}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => void handleRecalculateEmptyMiles()} disabled={recalculating || !customOriginInput.trim()}>
                            {recalculating && <Loader2 className="h-3 w-3 animate-spin" />}
                            Recalcular
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {emptyMilesOrigin && <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">desde {emptyMilesOrigin}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <div><span className="text-muted-foreground">RPM:</span> <span className={`font-bold ${rpmColorClass}`}>{rpm > 0 ? `$${rpm.toFixed(2)}` : '—'}</span></div>
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
              <div><span className="text-muted-foreground">Rate:</span> <span className="font-bold text-primary">${Number(load.total_rate).toLocaleString()}</span></div>
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

          {/* Pick Up Pictures */}
          <PickupPicturesSection loadId={load.id} />

          {/* POD Upload Section */}
          <PodUploadSection loadId={load.id} />
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border bg-card relative h-full" style={{ minHeight: 350, zIndex: 0 }}>
          <div ref={mapRef} style={{ height: '100%', minHeight: 350, zIndex: 0 }} />
        </div>
      </div>
    </div>
  );
};

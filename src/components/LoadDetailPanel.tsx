import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { MapPin, Calendar, Weight, DollarSign, User, Truck, Route, Navigation, FileText, Download, ExternalLink, Pencil, Loader2, Copy, Check, Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useTrucks } from '@/hooks/useTrucks';
import { useCompanies } from '@/hooks/useCompanies';
import type { DbLoad } from '@/hooks/useLoads';
import { useLoadStops } from '@/hooks/useLoadStops';
import { supabase } from '@/integrations/supabase/client';
import { PodUploadSection } from '@/components/PodUploadSection';
import { LoadAdjustmentsSection } from '@/components/LoadAdjustmentsSection';
import { PickupPicturesSection } from '@/components/PickupPicturesSection';
import { BolFormDialog } from '@/components/BolFormDialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useBrokerScores } from '@/hooks/useBrokerScores';
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
  // For addresses without commas, try extracting city+state+zip pattern at end
  if (parts.length === 1) {
    const m = place.match(/([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5})/);
    if (m) attempts.push(`${m[1].trim()}, ${m[2]} ${m[3]}`);
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

// Single OSRM call returning route geometry + per-leg distances
interface RouteWithLegs {
  geometry: [number, number][];
  legDistancesMiles: number[]; // one per leg (coords.length - 1)
  totalDistanceMiles: number;
}

async function drivingRouteWithLegs(coords: [number, number][]): Promise<RouteWithLegs | null> {
  if (coords.length < 2) return null;
  try {
    const waypoints = coords.map(c => `${c[1]},${c[0]}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const route = data.routes[0];
      const geometry = route.geometry?.coordinates?.map((c: number[]) => [c[1], c[0]] as [number, number]) || [];
      const legDistancesMiles = (route.legs || []).map((leg: any) => (leg.distance || 0) * 0.000621371);
      const totalDistanceMiles = route.distance * 0.000621371;
      return { geometry, legDistancesMiles, totalDistanceMiles };
    }
  } catch {}
  return null;
}

// Lightweight distance-only call (no geometry download)
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

async function drivingRoute(coords: [number, number][]): Promise<[number, number][] | null> {
  const result = await drivingRouteWithLegs(coords);
  return result ? result.geometry : null;
}

function normalizeRouteGeometry(input: unknown): [number, number][] | null {
  if (!Array.isArray(input)) return null;
  const normalized = input
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return [lat, lng] as [number, number];
    })
    .filter((point): point is [number, number] => point !== null);

  return normalized.length >= 2 ? normalized : null;
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

function BrokerScoreRow({ brokerName }: { brokerName: string | null | undefined }) {
  const { getScoreForBroker, upsertScore } = useBrokerScores();
  const [adding, setAdding] = useState(false);
  const [letterInput, setLetterInput] = useState('');
  const [daysInput, setDaysInput] = useState('');

  const existing = getScoreForBroker(brokerName);

  const letterColor = (letter: string) => {
    const l = letter.toUpperCase();
    if (['A', 'B', 'C'].includes(l)) return { bg: 'bg-green-600', text: 'text-white' };
    if (l === 'D') return { bg: 'bg-amber-500', text: 'text-white' };
    return { bg: 'bg-red-600', text: 'text-white' };
  };

  const handleSave = () => {
    if (!brokerName || !letterInput.trim()) return;
    const letter = letterInput.trim().toUpperCase();
    if (!/^[A-F]$/.test(letter)) return;
    const scoreNum = { A: 95, B: 85, C: 75, D: 55, E: 30, F: 10 }[letter] ?? 50;
    upsertScore.mutate({
      broker_name: brokerName.trim(),
      score: scoreNum,
      days_to_pay: daysInput ? parseInt(daysInput) : undefined,
      rating: letter,
    }, {
      onSuccess: () => {
        setAdding(false); setLetterInput(''); setDaysInput('');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{brokerName || '—'}</span>
        {existing?.mc_number && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600/10 text-blue-600 border border-blue-600/20">
            MC# {existing.mc_number}
          </span>
        )}
        {existing?.rating && (() => {
          const l = existing.rating.toUpperCase();
          const colors = letterColor(l);
          const isFactorable = ['A', 'B', 'C'].includes(l);
          return (
            <span className="inline-flex items-center gap-0.5">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-muted text-muted-foreground border">RTS</span>
              <span className={`px-2 py-0.5 rounded text-xs font-black ${colors.bg} ${colors.text}`}>
                {l}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isFactorable ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {isFactorable ? 'FACTORING' : 'COBRO DIRECTO'}
              </span>
            </span>
          );
        })()}
        {!existing && brokerName && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Agregar RTS Score">
            <Plus className="h-3 w-3" /> RTS
          </button>
        )}
        {existing && (
          <button onClick={() => { setAdding(true); setLetterInput(existing.rating ?? ''); setDaysInput(String(existing.days_to_pay ?? '')); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar RTS Score">
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-1.5">
          <select value={letterInput} onChange={(e) => setLetterInput(e.target.value)} className="h-7 w-20 text-xs rounded-md border border-input bg-card px-2">
            <option value="">Score</option>
            {['A', 'B', 'C', 'D', 'N', 'E', 'F'].map(l => (<option key={l} value={l}>{l}</option>))}
          </select>
          <Input placeholder="Días pago" type="number" min={0} value={daysInput} onChange={(e) => setDaysInput(e.target.value)} className="h-7 w-20 text-xs" />
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={upsertScore.isPending || !letterInput}>
            {upsertScore.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(false)}>✕</Button>
        </div>
      )}
    </div>
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
  const [bolDialogOpen, setBolDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { stops: dbStops, loading: stopsLoading, updateStopGeodata } = useLoadStops(load.id);
  const { companies } = useCompanies();
  const [mapReady, setMapReady] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'active' | 'stale' | 'none'>('none');
  const [cachedRouteGeometry, setCachedRouteGeometry] = useState<[number, number][] | null>(null);
  const [routeGeometryLoading, setRouteGeometryLoading] = useState(false);
  const routeFetchKeyRef = useRef<string | null>(null);

  // Sync local state when load prop changes (after refetch)
  useEffect(() => {
    setEmptyMiles(Number((load as any).empty_miles) || 0);
    setEmptyMilesOrigin((load as any).empty_miles_origin || null);
    setTotalMiles(Number(load.miles) || 0);
  }, [load.id, (load as any).empty_miles, (load as any).empty_miles_origin, load.miles]);

  // Fetch route_geometry separately (not in main loads query to keep it light)
  useEffect(() => {
    let active = true;
    const requestKey = `${load.id}:${Date.now()}`;
    routeFetchKeyRef.current = requestKey;
    setCachedRouteGeometry(null);
    setRouteGeometryLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('loads')
        .select('route_geometry')
        .eq('id', load.id)
        .maybeSingle();

      if (!active || routeFetchKeyRef.current !== requestKey) return;

      if (error) {
        console.error('[MAP] Error fetching route_geometry:', error);
        setCachedRouteGeometry(null);
      } else {
        setCachedRouteGeometry(normalizeRouteGeometry(data?.route_geometry ?? null));
      }
      setRouteGeometryLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [load.id]);

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
  const normalizedLoadRouteGeometry = useMemo(
    () => normalizeRouteGeometry(load.route_geometry),
    [load.route_geometry]
  );
  const effectiveRouteGeometry = cachedRouteGeometry || normalizedLoadRouteGeometry;
  const hasCachedRoute = Boolean(effectiveRouteGeometry && effectiveRouteGeometry.length >= 2);

  const stopSignature = useMemo(
    () => dbStops
      .map((s) => `${s.id}|${s.stop_order}|${s.stop_type}|${s.address}|${s.lat ?? 'n'}|${s.lng ?? 'n'}|${s.distance_from_prev ?? 'n'}`)
      .join(','),
    [dbStops]
  );
  const routeSignature = useMemo(() => {
    if (!effectiveRouteGeometry || effectiveRouteGeometry.length < 2) return 'none';
    const first = effectiveRouteGeometry[0];
    const last = effectiveRouteGeometry[effectiveRouteGeometry.length - 1];
    return `${effectiveRouteGeometry.length}:${first[0]},${first[1]}:${last[0]},${last[1]}`;
  }, [effectiveRouteGeometry]);

  // Check if all stops have cached geodata
  const allStopsCached = dbStops.length > 0 && dbStops.every(s => s.lat != null && s.lng != null);

  useEffect(() => {
    persistedRef.current = false;
    if (stopsLoading) return;
    // Don't wait for routeGeometryLoading - render immediately with what we have
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

      // Helper: calculate empty miles (deadhead) from manual location or previous delivered load
      const calculateEmptyMiles = async (L: any, map: any, resolved: ResolvedStop[], bounds: [number, number][]) => {
        if (cancelled) return;
        const firstPickup = resolved.find(s => s.type === 'pickup' && s.coords);
        if (!firstPickup?.coords) return;

        const drawDeadhead = async (originCoords: [number, number], originAddress: string, label = 'Empty Miles Origin') => {
          if (cancelled) return;

          const deadheadIcon = L.divIcon({
            html: '<div style="background:hsl(38,92%,50%);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">E</div>',
            className: '', iconSize: [24, 24], iconAnchor: [12, 12],
          });
          L.marker(originCoords, { icon: deadheadIcon }).addTo(map).bindPopup(`<b>${label}</b><br/>${originAddress}`);

          const deadheadRoute = await drivingRoute([originCoords, firstPickup.coords!]);
          if (cancelled) return;

          if (deadheadRoute) {
            L.polyline(deadheadRoute, { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
          } else {
            L.polyline([originCoords, firstPickup.coords!], { color: 'hsl(38,92%,50%)', weight: 3, dashArray: '8 6', opacity: 0.8 }).addTo(map);
          }

          bounds.push(originCoords);
          map.fitBounds(bounds, { padding: [40, 40] });
        };

        const applyAndPersistDeadhead = async (originCoords: [number, number], originAddress: string, mapLabel?: string) => {
          const dist = await drivingDistance(originCoords[0], originCoords[1], firstPickup.coords![0], firstPickup.coords![1]);
          if (dist === null) return false;

          const roundedDist = Math.round(dist);
          setEmptyMiles(roundedDist);
          setEmptyMilesOrigin(originAddress);

          const currentEmptyMiles = Number((load as any).empty_miles) || 0;
          const currentOrigin = (load as any).empty_miles_origin || null;
          const changed = roundedDist !== currentEmptyMiles || originAddress !== currentOrigin;

          if (changed) {
            await supabase.from('loads').update({
              empty_miles: roundedDist,
              empty_miles_origin: originAddress,
            } as any).eq('id', load.id);
            queryClient.invalidateQueries({ queryKey: ['loads'] });
          }

          await drawDeadhead(originCoords, originAddress, mapLabel || 'Empty Miles Origin');
          return true;
        };

        // 1) Manual location has top priority (where driver starts empty)
        if (load.driver_id && load.pickup_date) {
          const { data: driverData } = await supabase
            .from('drivers' as any)
            .select('manual_location_address, manual_location_lat, manual_location_lng')
            .eq('id', load.driver_id)
            .maybeSingle();

          const manualLoc = driverData as any;
          if (manualLoc?.manual_location_address) {
            let manualCoords: [number, number] | null = null;
            const hasManualCoords =
              manualLoc?.manual_location_lat != null &&
              manualLoc?.manual_location_lng != null &&
              Number.isFinite(Number(manualLoc.manual_location_lat)) &&
              Number.isFinite(Number(manualLoc.manual_location_lng));

            if (hasManualCoords) {
              manualCoords = [Number(manualLoc.manual_location_lat), Number(manualLoc.manual_location_lng)];
            } else {
              manualCoords = await geocode(manualLoc.manual_location_address);
            }

            if (manualCoords) {
              await applyAndPersistDeadhead(manualCoords, manualLoc.manual_location_address, 'Empty Miles Origin (Manual)');
              await supabase.from('drivers' as any).update({
                manual_location_address: null,
                manual_location_lat: null,
                manual_location_lng: null,
              } as any).eq('id', load.driver_id);
              return;
            }
          }
        }

        // 2) If we already have cached empty miles, use them (any status)
        const hasCachedEmptyMiles = Number((load as any).empty_miles) > 0 && Boolean((load as any).empty_miles_origin);

        if (hasCachedEmptyMiles) {
          setEmptyMiles(Number((load as any).empty_miles));
          setEmptyMilesOrigin((load as any).empty_miles_origin || null);

          if ((load as any).empty_miles_origin) {
            const cachedCoords = await geocode((load as any).empty_miles_origin);
            if (cachedCoords) {
              await drawDeadhead(cachedCoords, (load as any).empty_miles_origin);
            }
          }
          return;
        }

        // 3) Otherwise use the last delivery stop from previous DELIVERED/PAID load
        if (!load.driver_id || !load.pickup_date) return;

        const { data: prevLoads } = await supabase
          .from('loads')
          .select('id, delivery_date, created_at')
          .eq('driver_id', load.driver_id)
          .neq('id', load.id)
          .in('status', ['delivered', 'paid'])
          .lte('delivery_date', load.pickup_date)
          .order('delivery_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);

        if (!prevLoads || prevLoads.length === 0) return;

        const { data: prevStops } = await supabase
          .from('load_stops')
          .select('*')
          .eq('load_id', prevLoads[0].id)
          .eq('stop_type', 'delivery')
          .order('stop_order', { ascending: false })
          .limit(1);

        if (!prevStops || prevStops.length === 0) return;

        const prevStop = prevStops[0];
        const prevCoords = (prevStop.lat != null && prevStop.lng != null)
          ? [prevStop.lat, prevStop.lng] as [number, number]
          : await geocode(prevStop.address);

        if (!prevCoords) return;

        await applyAndPersistDeadhead(prevCoords, prevStop.address);
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

      // FAST PATH: all stop geodata cached
      if (allStopsCached) {
        console.log('[MAP] Using cached stop geodata' + (hasCachedRoute ? ' + route geometry' : ''));
        const cachedRoute = effectiveRouteGeometry;
        const resolved: ResolvedStop[] = stopSources.map(s => ({
          type: s.type,
          address: s.address,
          coords: [Number(s.cachedLat), Number(s.cachedLng)] as [number, number],
          distanceFromPrev: s.cachedDist != null ? Math.round(Number(s.cachedDist)) : undefined,
        }));

        setResolvedStops(resolved);

        // Render markers + route IMMEDIATELY (no waiting for OSRM)
        const bounds: [number, number][] = [];
        resolved.forEach(stop => {
          if (!stop.coords) return;
          const [lat, lng] = stop.coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const icon = stop.type === 'pickup' ? pickupIcon : deliveryIcon;
          L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(`<b>${stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}</b><br/>${stop.address}`);
          bounds.push([lat, lng]);
        });

        if (cachedRoute && cachedRoute.length >= 2) {
          try {
            L.polyline(cachedRoute, { color: 'hsl(215,70%,50%)', weight: 3 }).addTo(map);
          } catch (e) {
            console.warn('[MAP] Cached polyline failed:', e);
            if (bounds.length >= 2) L.polyline(bounds, { color: 'hsl(215,70%,50%)', weight: 3, dashArray: '8 4' }).addTo(map);
          }
        } else if (bounds.length >= 2) {
          // No route geometry yet - draw straight lines, calculate route in background
          L.polyline(bounds, { color: 'hsl(215,70%,50%)', weight: 3, dashArray: '8 4' }).addTo(map);
        }

        if (bounds.length >= 2) map.fitBounds(bounds, { padding: [40, 40] });
        else if (bounds.length === 1) map.setView(bounds[0], 10);

        // Calculate total miles from what we have NOW
        const loadMiles = Number(load.miles) || 0;
        const sumFromStops = resolved.reduce((sum, s) => sum + (s.distanceFromPrev || 0), 0);
        if (loadMiles > 0) {
          setTotalMiles(loadMiles);
        } else if (sumFromStops > 0) {
          setTotalMiles(sumFromStops);
          if (onMilesCalculated && !persistedRef.current) {
            persistedRef.current = true;
            onMilesCalculated(load.id, sumFromStops, cachedRoute || undefined);
          }
        }

        // BACKGROUND: calculate missing distances without blocking UI
        const missingDists = resolved.some((_, i) => i > 0 && resolved[i].coords && resolved[i - 1].coords && stopSources[i].cachedDist == null);
        if (missingDists && loadMiles === 0 && sumFromStops === 0) {
          (async () => {
            const coordsForRoute = resolved.filter(s => s.coords).map(s => s.coords!);
            const routeResult = await drivingRouteWithLegs(coordsForRoute);
            if (cancelled) return;
            if (routeResult) {
              let legIdx = 0;
              let totalFromLegs = 0;
              for (let i = 1; i < resolved.length; i++) {
                if (!resolved[i].coords || !resolved[i - 1].coords) continue;
                if (stopSources[i].cachedDist == null && legIdx < routeResult.legDistancesMiles.length) {
                  resolved[i].distanceFromPrev = Math.round(routeResult.legDistancesMiles[legIdx]);
                  totalFromLegs += routeResult.legDistancesMiles[legIdx];
                  if (stopSources[i].id) {
                    updateStopGeodata(stopSources[i].id, resolved[i].coords![0], resolved[i].coords![1], routeResult.legDistancesMiles[legIdx]);
                  }
                }
                legIdx++;
              }
              const rounded = Math.round(totalFromLegs);
              if (rounded > 0 && !cancelled) {
                setTotalMiles(rounded);
                setResolvedStops([...resolved]);
                if (onMilesCalculated && !persistedRef.current) {
                  persistedRef.current = true;
                  onMilesCalculated(load.id, rounded, routeResult.geometry || cachedRoute || undefined);
                }
              }
              // Also persist route geometry if we didn't have one
              if (!cachedRoute && routeResult.geometry && routeResult.geometry.length >= 2 && !cancelled) {
                try {
                  L.polyline(routeResult.geometry, { color: 'hsl(215,70%,50%)', weight: 3 }).addTo(map);
                } catch {}
              }
            }
          })();
        }

        if (!cancelled) {
          try {
            await calculateEmptyMiles(L, map, resolved, bounds);
          } catch (error) {
            console.error('[MAP] Empty miles calculation failed (fast path):', error);
          }
          setMapReady(true);
        }
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

      // Check if all distances are already cached
      const allDistsCached = resolved.every((_, i) => i === 0 || !resolved[i].coords || !resolved[i - 1].coords || stopSources[i].cachedDist != null);

      const bounds: [number, number][] = [];
      try {
        resolved.forEach(stop => {
          if (!stop.coords) return;
          const icon = stop.type === 'pickup' ? pickupIcon : deliveryIcon;
          L.marker(stop.coords, { icon }).addTo(map).bindPopup(`<b>${stop.type === 'pickup' ? 'Pick Up' : 'Delivery'}</b><br/>${stop.address}`);
          bounds.push(stop.coords);
        });
      } catch (e) { console.warn('[MAP] Error adding markers:', e); }

      let routeCoords: [number, number][] | null = null;
      let accumulatedMiles = 0;

      // Single OSRM call for geometry + per-leg distances (slow path optimization)
      if (bounds.length >= 2) {
        if (hasCachedRoute) {
          routeCoords = effectiveRouteGeometry!;
        }
        // Check if any distances need calculating
        const needsDistCalc = !hasCachedRoute || resolved.some((_, i) => i > 0 && resolved[i].coords && resolved[i - 1].coords && stopSources[i].cachedDist == null);
        
        if (!hasCachedRoute || needsDistCalc) {
          const routeResult = await drivingRouteWithLegs(bounds);
          if (cancelled) return;
          if (routeResult) {
            if (!hasCachedRoute) routeCoords = routeResult.geometry;
            // Map legs to resolved stops: bounds[j] matches resolved stops that have coords
            // bounds has bounds.length entries, routeResult has bounds.length-1 legs
            let legIdx = 0;
            for (let i = 1; i < resolved.length; i++) {
              if (!resolved[i].coords || !resolved[i - 1].coords) continue;
              if (stopSources[i].cachedDist != null) {
                resolved[i].distanceFromPrev = Math.round(Number(stopSources[i].cachedDist));
                accumulatedMiles += Number(stopSources[i].cachedDist);
              } else if (legIdx < routeResult.legDistancesMiles.length) {
                resolved[i].distanceFromPrev = Math.round(routeResult.legDistancesMiles[legIdx]);
                accumulatedMiles += routeResult.legDistancesMiles[legIdx];
              }
              legIdx++;
            }
          }
        } else {
          // All distances cached
          for (let i = 1; i < resolved.length; i++) {
            if (stopSources[i].cachedDist != null && resolved[i].coords && resolved[i - 1].coords) {
              resolved[i].distanceFromPrev = Math.round(Number(stopSources[i].cachedDist));
              accumulatedMiles += Number(stopSources[i].cachedDist);
            }
          }
        }
      }

      if (cancelled) return;

      try {
        if (bounds.length >= 2) {
          if (routeCoords && routeCoords.length >= 2) {
            L.polyline(routeCoords, { color: 'hsl(215,70%,50%)', weight: 3 }).addTo(map);
          } else {
            L.polyline(bounds, { color: 'hsl(215,70%,50%)', weight: 3, dashArray: '8 4' }).addTo(map);
          }
          map.fitBounds(bounds, { padding: [40, 40] });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 10);
        }
      } catch (e) { console.warn('[MAP] Error adding route:', e); }

      if (!cancelled) {
        setResolvedStops(resolved);
        const rounded = Math.round(accumulatedMiles);
        if (rounded > 0) setTotalMiles(rounded);

        // Persist geodata to load_stops for future fast loads
        for (let i = 0; i < resolved.length; i++) {
          const s = stopSources[i];
          const r = resolved[i];
          if (s.id && r.coords && (s.cachedLat == null || s.cachedLng == null || (s.cachedDist == null && r.distanceFromPrev != null))) {
            updateStopGeodata(s.id, r.coords[0], r.coords[1], r.distanceFromPrev);
          }
        }

        if ((rounded > 0 || routeCoords) && onMilesCalculated && !persistedRef.current) {
          persistedRef.current = true;
          onMilesCalculated(load.id, rounded, routeCoords || undefined);
        }

        try {
          await calculateEmptyMiles(L, map, resolved, bounds);
        } catch (error) {
          console.error('[MAP] Empty miles calculation failed (slow path):', error);
        }
        setMapReady(true);
      }
    };

    initMap();
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id, load.origin, load.destination, stopsLoading, routeGeometryLoading, stopSignature, routeSignature]);

  // === Driver GPS Live Marker ===
  useEffect(() => {
    if (!load.driver_id || !mapInstanceRef.current || !mapReady) return;

    const driverId = load.driver_id;
    let driverMarkerRef: any = null;
    let isCancelled = false;

    const FIVE_MINUTES = 5 * 60 * 1000;

    const isActive = (updatedAt: string) =>
      Date.now() - new Date(updatedAt).getTime() < FIVE_MINUTES;

    const formatAgo = (updatedAt: string) => {
      const diffMs = Date.now() - new Date(updatedAt).getTime();
      const diffSec = Math.round(diffMs / 1000);
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.round(diffMin / 60);
      return `${diffHr}h ago`;
    };

    const createOrUpdateMarker = async (loc: { lat: number; lng: number; speed: number | null; updated_at: string }) => {
      if (isCancelled || !mapInstanceRef.current) return;

      const active = isActive(loc.updated_at);
      setGpsStatus(active ? 'active' : 'stale');

      const L = (await import('leaflet')).default;
      const speedMph = loc.speed != null ? Math.round(loc.speed * 2.237) : null;
      const agoText = formatAgo(loc.updated_at);

      const statusLabel = active ? '🛰 GPS Live' : '📍 Last Known';
      const statusColor = active ? 'hsl(142,70%,40%)' : 'hsl(30,80%,50%)';
      const markerBg = active ? 'hsl(215,70%,50%)' : 'hsl(30,80%,50%)';
      const pulseBg = active ? 'hsl(215,70%,50%,0.25)' : 'hsl(30,80%,50%,0.15)';
      const pulseAnim = active ? 'animation:pulse 2s infinite' : '';

      const popupHtml = `<div style="text-align:center"><b style="color:${statusColor}">${statusLabel}</b><br/>${driver?.name || 'Driver'}<br/>${active && speedMph != null ? `${speedMph} mph<br/>` : ''}<small>${agoText}</small></div>`;

      if (driverMarkerRef) {
        driverMarkerRef.setLatLng([loc.lat, loc.lng]);
        driverMarkerRef.getPopup()?.setContent(popupHtml);
        // Update icon style
        const newIcon = L.divIcon({
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
            <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:${pulseBg};${pulseAnim}"></div>
            <div style="width:24px;height:24px;border-radius:50%;background:${markerBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);position:relative;z-index:1">🚛</div>
          </div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        driverMarkerRef.setIcon(newIcon);
      } else {
        const driverIcon = L.divIcon({
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
            <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:${pulseBg};${pulseAnim}"></div>
            <div style="width:24px;height:24px;border-radius:50%;background:${markerBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);position:relative;z-index:1">🚛</div>
          </div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        driverMarkerRef = L.marker([loc.lat, loc.lng], { icon: driverIcon, zIndexOffset: 1000 })
          .addTo(mapInstanceRef.current)
          .bindPopup(popupHtml);
      }
    };

    // Initial fetch
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lng, speed, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle();
      if (data && !isCancelled) {
        createOrUpdateMarker(data as any);
      } else if (!isCancelled) {
        setGpsStatus('none');
      }
    };
    fetchInitial();

    // Realtime subscription
    const channel = supabase
      .channel(`load-detail-driver-${load.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload: any) => {
        if (payload.new) createOrUpdateMarker(payload.new);
      })
      .subscribe();

    // Periodic check to update stale status and popup text
    const staleCheck = setInterval(async () => {
      if (!isCancelled) {
        const { data } = await supabase
          .from('driver_locations')
          .select('lat, lng, speed, updated_at')
          .eq('driver_id', driverId)
          .maybeSingle();
        if (data && !isCancelled) createOrUpdateMarker(data as any);
      }
    }, 60000);

    return () => {
      isCancelled = true;
      setGpsStatus('none');
      supabase.removeChannel(channel);
      clearInterval(staleCheck);
      if (driverMarkerRef && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(driverMarkerRef); } catch {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id, load.driver_id, mapReady]);

  return (
    <div className="p-4 bg-muted/30 border-t animate-in slide-in-from-top-2 duration-200">
      {/* Company Banner */}
      {(() => {
        const company = companies.find(c => c.id === (load as any).company_id);
        return company ? (
          <div className="flex items-start gap-3 p-3 mb-4 bg-primary/5 border-l-4 border-primary rounded-r-lg">
            <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm uppercase text-foreground tracking-wide">{company.name}</h3>
              <p className="text-xs text-muted-foreground">
                {[company.mc_number && `MC# ${company.mc_number}`, company.dot_number && `DOT# ${company.dot_number}`].filter(Boolean).join('  •  ') || 'Sin MC/DOT registrado'}
              </p>
            </div>
          </div>
        ) : null;
      })()}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Info */}
          <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">Load Detail</h4>
            <CopyLoadInfoButton load={load} totalMiles={totalMiles} emptyMiles={emptyMiles} rpm={rpm} driver={driver} dispatcher={dispatcher} />
          </div>

          {/* Structured table layout */}
          <table className="w-full rounded-lg border bg-card overflow-hidden text-sm border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <tbody>
            {/* Broker row - full width */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Broker:</td>
              <td colSpan={3} className="px-3 py-2">
                <BrokerScoreRow brokerName={load.broker_client} />
              </td>
            </tr>

            {/* Pick Up row */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Pick Up:</td>
              <td className="px-3 py-2 font-medium border-r">
                <div className="flex items-center gap-1">
                  {(() => {
                    const pickupStop = resolvedStops.find(s => s.type === 'pickup') || null;
                    const addr = pickupStop?.address || load.origin;
                    return (
                      <>
                        <span className="truncate">{addr}</span>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 p-0.5 rounded hover:bg-muted text-primary"><Navigation className="h-3 w-3" /></a>
                      </>
                    );
                  })()}
                </div>
              </td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Pickup:</td>
              <td className="px-3 py-2 font-medium">{formatDate(load.pickup_date)}</td>
            </tr>

            {/* Delivery row */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Delivery:</td>
              <td className="px-3 py-2 font-medium border-r">
                <div className="flex items-center gap-1">
                  {(() => {
                    const deliveryStop = resolvedStops.filter(s => s.type === 'delivery').pop() || null;
                    const addr = deliveryStop?.address || load.destination;
                    return (
                      <>
                        <span className="truncate">{addr}</span>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 p-0.5 rounded hover:bg-muted text-primary"><Navigation className="h-3 w-3" /></a>
                      </>
                    );
                  })()}
                </div>
              </td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Delivery:</td>
              <td className="px-3 py-2 font-medium">{formatDate(load.delivery_date)}</td>
            </tr>

            {/* Weight / Type row */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Weight:</td>
              <td className="px-3 py-2 font-medium border-r">{load.weight ? `${load.weight.toLocaleString()} lbs` : '—'}</td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Type:</td>
              <td className="px-3 py-2 font-medium">{truck?.truck_type || '—'}</td>
            </tr>

            {/* Miles / Empty Miles row */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Miles:</td>
              <td className="px-3 py-2 font-bold text-primary border-r">{totalMiles > 0 ? totalMiles.toLocaleString() : '—'}</td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Empty Miles:</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
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
                {emptyMilesOrigin && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">desde {emptyMilesOrigin}</div>}
              </td>
            </tr>

            {/* Driver / RPM row */}
            <tr className="border-b">
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Driver:</td>
              <td className="px-3 py-2 font-medium border-r">{driver?.name || 'Sin asignar'}</td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">$ RPM:</td>
              <td className={`px-3 py-2 font-bold ${rpmColorClass}`}>{rpm > 0 ? `$${rpm.toFixed(2)}` : '—'}</td>
            </tr>

            {/* Dispatcher / Rate row */}
            <tr>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">Dispatcher:</td>
              <td className="px-3 py-2 font-medium border-r">{dispatcher?.name || '—'}</td>
              <td className="px-3 py-2 bg-muted/50 font-medium text-muted-foreground whitespace-nowrap border-r">$ Rate:</td>
              <td className="px-3 py-2 font-bold text-primary">${Number(load.total_rate).toLocaleString()}</td>
            </tr>
            </tbody>
          </table>

          {/* Load Adjustments */}
          {(['in_transit', 'delivered', 'tonu'].includes(load.status)) && (
            <LoadAdjustmentsSection loadId={load.id} />
          )}

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

          {/* PDF + BOL side by side */}
          <div className="grid grid-cols-2 gap-3">
            {load.pdf_url ? (
              <div className="p-2.5 rounded-lg bg-card border text-sm">
                <h5 className="font-semibold mb-1.5 flex items-center gap-1.5 text-xs">
                  <FileText className="h-3 w-3 text-primary" /> Documento Original (PDF)
                </h5>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="gap-1 text-[11px] h-7 px-2" onClick={() => { void openOriginalPdf(); }}>
                    <ExternalLink className="h-3 w-3" /> Ver
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-[11px] h-7 px-2" onClick={() => { void downloadOriginalPdf(); }}>
                    <Download className="h-3 w-3" /> Descargar
                  </Button>
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="p-2.5 rounded-lg bg-card border text-sm">
              <h5 className="font-semibold mb-1.5 flex items-center gap-1.5 text-xs">
                <FileText className="h-3 w-3 text-primary" /> Bill of Lading (BOL)
              </h5>
              <Button variant="outline" size="sm" className="gap-1 text-[11px] h-7 px-2" onClick={() => setBolDialogOpen(true)}>
                <Download className="h-3 w-3" /> Generar BOL
              </Button>
            </div>
          </div>
          <BolFormDialog
            open={bolDialogOpen}
            onOpenChange={setBolDialogOpen}
            load={load}
            stops={dbStops.map(s => ({ id: s.id, stop_type: s.stop_type, address: s.address, stop_order: s.stop_order }))}
            company={companies.length > 0 ? companies[0] : null}
            driverName={driver?.name}
          />

          {/* Pick Up Pictures */}
          <PickupPicturesSection loadId={load.id} />

          {/* POD Upload Section */}
          <PodUploadSection loadId={load.id} />
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border bg-card relative h-full" style={{ minHeight: 350, zIndex: 0 }}>
          <div ref={mapRef} style={{ height: '100%', minHeight: 350, zIndex: 0 }} />
          {gpsStatus !== 'none' && (
            <div className="absolute top-2 right-2 z-[1000] pointer-events-none">
              {gpsStatus === 'active' ? (
                <div className="flex items-center gap-1.5 bg-green-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  GPS Active
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-orange-500/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white/70"></span>
                  </span>
                  Last Location
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

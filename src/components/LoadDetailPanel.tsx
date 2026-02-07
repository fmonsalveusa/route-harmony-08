import { useEffect, useRef } from 'react';
import { MapPin, Calendar, Weight, DollarSign, User, Truck } from 'lucide-react';
import { mockDrivers, mockDispatchers } from '@/data/mockData';
import type { DbLoad } from '@/hooks/useLoads';
import 'leaflet/dist/leaflet.css';

// Simple geocoding using Nominatim (free)
async function geocode(place: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`);
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

interface LoadDetailPanelProps {
  load: DbLoad;
}

export const LoadDetailPanel = ({ load }: LoadDetailPanelProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const driver = mockDrivers.find(d => d.id === load.driver_id);
  const dispatcher = mockDispatchers.find(d => d.id === load.dispatcher_id);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // Fix default icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;

      // Clean previous
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const [originCoords, destCoords] = await Promise.all([
        geocode(load.origin),
        geocode(load.destination),
      ]);

      if (cancelled) return;

      const pickupIcon = L.divIcon({
        html: '<div style="background:hsl(152,60%,40%);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">P</div>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const deliveryIcon = L.divIcon({
        html: '<div style="background:hsl(0,72%,51%);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">D</div>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const bounds: [number, number][] = [];

      if (originCoords) {
        L.marker(originCoords, { icon: pickupIcon }).addTo(map).bindPopup(`<b>Pick Up</b><br/>${load.origin}`);
        bounds.push(originCoords);
      }
      if (destCoords) {
        L.marker(destCoords, { icon: deliveryIcon }).addTo(map).bindPopup(`<b>Delivery</b><br/>${load.destination}`);
        bounds.push(destCoords);
      }

      if (bounds.length === 2) {
        L.polyline(bounds, { color: 'hsl(215,70%,50%)', weight: 3, dashArray: '8 4' }).addTo(map);
        map.fitBounds(bounds, { padding: [40, 40] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 10);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [load.origin, load.destination]);

  return (
    <div className="p-4 bg-muted/30 border-t animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Info */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Detalle de la Carga</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-green-600" />
              <div><span className="text-muted-foreground">Pick Up:</span> <span className="font-medium">{load.origin}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-red-600" />
              <div><span className="text-muted-foreground">Delivery:</span> <span className="font-medium">{load.destination}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Recogida:</span> <span className="font-medium">{load.pickup_date || '—'}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div><span className="text-muted-foreground">Entrega:</span> <span className="font-medium">{load.delivery_date || '—'}</span></div>
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

          {/* Payment breakdown */}
          {load.total_rate > 0 && (
            <div className="p-3 rounded-lg bg-card border text-sm">
              <h5 className="font-semibold mb-2">Desglose de Pagos</h5>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Driver:</span><span className="font-medium">${Number(load.driver_pay_amount).toLocaleString()}</span>
                <span className="text-muted-foreground">Investor:</span><span className="font-medium">${Number(load.investor_pay_amount).toLocaleString()}</span>
                <span className="text-muted-foreground">Dispatcher:</span><span className="font-medium">${Number(load.dispatcher_pay_amount).toLocaleString()}</span>
                <span className="text-muted-foreground font-semibold">Utilidad:</span><span className="font-bold text-primary">${Number(load.company_profit).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border bg-card" style={{ minHeight: 280 }}>
          <div ref={mapRef} style={{ height: '100%', minHeight: 280 }} />
        </div>
      </div>
    </div>
  );
};

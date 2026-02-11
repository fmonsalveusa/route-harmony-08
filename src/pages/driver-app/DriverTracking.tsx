import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantId } from '@/hooks/useTenantId';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function DriverTracking() {
  const { profile } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!profile?.email) return;
    supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle().then(({ data }) => {
      if (data) setDriverId(data.id);
    });
  }, [profile?.email]);

  const sendPosition = async (pos: GeolocationPosition) => {
    if (!driverId) return;
    const tenant_id = await getTenantId();
    const payload = {
      driver_id: driverId,
      tenant_id,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      accuracy: pos.coords.accuracy,
      updated_at: new Date().toISOString(),
    };

    setLastPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });

    // Upsert
    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  };

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'GPS not available', variant: 'destructive' });
      return;
    }

    setTracking(true);
    toast({ title: 'GPS Tracking started' });

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { posRef.current = pos; sendPosition(pos); },
      (err) => { console.error('GPS error:', err); toast({ title: 'GPS error', description: err.message, variant: 'destructive' }); },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    // Send every 30s
    intervalRef.current = setInterval(() => {
      if (posRef.current) sendPosition(posRef.current);
    }, 30000);
  };

  const stopTracking = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchRef.current = null;
    intervalRef.current = null;
    setTracking(false);
    toast({ title: 'GPS Tracking stopped' });
  };

  useEffect(() => () => { stopTracking(); }, []);

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-lg font-bold">GPS Tracking</h1>

      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${tracking ? 'bg-success/20' : 'bg-muted'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tracking ? 'bg-success animate-pulse' : 'bg-muted-foreground/20'}`}>
              <Navigation className={`h-6 w-6 ${tracking ? 'text-success-foreground' : 'text-muted-foreground'}`} />
            </div>
          </div>

          <p className="text-sm font-medium">{tracking ? 'Tracking Active' : 'Tracking Off'}</p>

          <Button
            size="lg"
            className={`w-full gap-2 ${tracking ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={tracking ? stopTracking : startTracking}
          >
            <MapPin className="h-5 w-5" />
            {tracking ? 'Stop Tracking' : 'Start Tracking'}
          </Button>
        </CardContent>
      </Card>

      {lastPosition && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Last known position</p>
            <p className="text-sm font-mono">{lastPosition.lat.toFixed(6)}, {lastPosition.lng.toFixed(6)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

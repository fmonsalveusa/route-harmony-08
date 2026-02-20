import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from '@/hooks/use-toast';

interface ActiveStop {
  id: string;
  load_id: string;
  address: string;
  stop_type: string;
  stop_order: number;
  lat: number;
  lng: number;
}

interface DriverTrackingContextType {
  tracking: boolean;
  lastPosition: { lat: number; lng: number } | null;
  startTracking: () => void;
  stopTracking: () => void;
  nearbyStop: ActiveStop | null;
  confirmArrival: (stopId: string) => Promise<void>;
  dismissArrival: () => void;
}

const DriverTrackingContext = createContext<DriverTrackingContextType | null>(null);

const GEOFENCE_RADIUS_METERS = 300;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ACTIVE_LOAD_STATUSES = ['dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];

export const DriverTrackingProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [nearbyStop, setNearbyStop] = useState<ActiveStop | null>(null);
  const [activeStops, setActiveStops] = useState<ActiveStop[]>([]);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef<GeolocationPosition | null>(null);
  const dismissedStopsRef = useRef<Set<string>>(new Set());
  const stopsRefreshTrigger = useRef(0);
  const [refreshStops, setRefreshStops] = useState(0);

  useEffect(() => {
    if (!profile?.email) return;
    supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle().then(({ data }) => {
      if (data) setDriverId(data.id);
    });
  }, [profile?.email]);

  // Fetch active stops for the driver
  useEffect(() => {
    if (!driverId || !tracking) {
      setActiveStops([]);
      return;
    }

    const fetchActiveStops = async () => {
      const { data: loads } = await supabase
        .from('loads')
        .select('id')
        .eq('driver_id', driverId)
        .in('status', ACTIVE_LOAD_STATUSES);

      if (!loads || loads.length === 0) {
        setActiveStops([]);
        return;
      }

      const loadIds = loads.map(l => l.id);
      const { data: stops } = await supabase
        .from('load_stops')
        .select('id, load_id, address, stop_type, stop_order, lat, lng')
        .in('load_id', loadIds)
        .is('arrived_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (stops) {
        setActiveStops(stops.filter(s => s.lat !== null && s.lng !== null) as ActiveStop[]);
      }
    };

    fetchActiveStops();
  }, [driverId, tracking, refreshStops]);

  // Check proximity on position updates
  const checkGeofence = useCallback((lat: number, lng: number) => {
    if (activeStops.length === 0) return;

    for (const stop of activeStops) {
      if (dismissedStopsRef.current.has(stop.id)) continue;
      const distance = haversineDistance(lat, lng, stop.lat, stop.lng);
      if (distance <= GEOFENCE_RADIUS_METERS) {
        setNearbyStop(stop);
        return;
      }
    }
  }, [activeStops]);

  const confirmArrival = useCallback(async (stopId: string) => {
    const stop = activeStops.find(s => s.id === stopId);
    if (!stop) return;

    const { error } = await supabase
      .from('load_stops')
      .update({ arrived_at: new Date().toISOString() } as any)
      .eq('id', stopId);

    if (error) {
      toast({ title: 'Error marking arrival', variant: 'destructive' });
      return;
    }

    // Create notification for web app
    const tenant_id = await getTenantId();
    const { data: loadData } = await supabase
      .from('loads')
      .select('reference_number')
      .eq('id', stop.load_id)
      .single();

    const refNum = loadData?.reference_number || '';
    await supabase.from('notifications').insert({
      tenant_id,
      type: 'driver_arrived',
      title: 'Driver Arrived',
      message: `Driver arrived at ${stop.address} (Load ${refNum})`,
      load_id: stop.load_id,
      driver_id: driverId,
    } as any);

    dismissedStopsRef.current.add(stopId);
    setNearbyStop(null);
    setRefreshStops(prev => prev + 1);
    toast({ title: 'Llegada registrada ✓' });
  }, [activeStops, driverId]);

  const dismissArrival = useCallback(() => {
    if (nearbyStop) {
      dismissedStopsRef.current.add(nearbyStop.id);
    }
    setNearbyStop(null);
  }, [nearbyStop]);

  const sendPosition = useCallback(async (pos: GeolocationPosition) => {
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
    checkGeofence(pos.coords.latitude, pos.coords.longitude);

    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId, checkGeofence]);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'GPS not available', variant: 'destructive' });
      return;
    }
    if (tracking) return;

    setTracking(true);
    dismissedStopsRef.current.clear();
    toast({ title: 'GPS Tracking started' });

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { posRef.current = pos; sendPosition(pos); },
      (err) => { console.error('GPS error:', err); toast({ title: 'GPS error', description: err.message, variant: 'destructive' }); },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    intervalRef.current = setInterval(() => {
      if (posRef.current) sendPosition(posRef.current);
    }, 30000);
  }, [tracking, sendPosition]);

  const stopTracking = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchRef.current = null;
    intervalRef.current = null;
    setTracking(false);
    setNearbyStop(null);
    setActiveStops([]);
    toast({ title: 'GPS Tracking stopped' });
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <DriverTrackingContext.Provider value={{ tracking, lastPosition, startTracking, stopTracking, nearbyStop, confirmArrival, dismissArrival }}>
      {children}
    </DriverTrackingContext.Provider>
  );
};

export const useDriverTracking = () => {
  const ctx = useContext(DriverTrackingContext);
  if (!ctx) throw new Error('useDriverTracking must be used within DriverTrackingProvider');
  return ctx;
};

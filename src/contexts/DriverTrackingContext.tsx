import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from '@/hooks/use-toast';

interface DriverTrackingContextType {
  tracking: boolean;
  lastPosition: { lat: number; lng: number } | null;
  startTracking: () => void;
  stopTracking: () => void;
}

const DriverTrackingContext = createContext<DriverTrackingContextType | null>(null);

export const DriverTrackingProvider = ({ children }: { children: ReactNode }) => {
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

    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId]);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'GPS not available', variant: 'destructive' });
      return;
    }
    if (tracking) return; // Already tracking

    setTracking(true);
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
    toast({ title: 'GPS Tracking stopped' });
  }, []);

  // Cleanup only on full unmount (logout)
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <DriverTrackingContext.Provider value={{ tracking, lastPosition, startTracking, stopTracking }}>
      {children}
    </DriverTrackingContext.Provider>
  );
};

export const useDriverTracking = () => {
  const ctx = useContext(DriverTrackingContext);
  if (!ctx) throw new Error('useDriverTracking must be used within DriverTrackingProvider');
  return ctx;
};

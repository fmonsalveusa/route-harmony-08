import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from '@/hooks/use-toast';
import { isNativePlatform, startNativeTracking, stopNativeTracking, hasActiveWatcher } from '@/lib/nativeTracking';
import { App as CapApp } from '@capacitor/app';

interface ActiveStop {
  id: string;
  load_id: string;
  address: string;
  stop_type: string;
  stop_order: number;
  lat: number;
  lng: number;
}

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unknown';

interface DriverTrackingContextType {
  tracking: boolean;
  lastPosition: { lat: number; lng: number } | null;
  speed: number | null;
  accuracy: number | null;
  permissionStatus: PermissionStatus;
  startTracking: () => void;
  stopTracking: () => void;
  nearbyStop: ActiveStop | null;
  confirmArrival: (stopId: string) => Promise<void>;
  dismissArrival: () => void;
}

const DriverTrackingContext = createContext<DriverTrackingContextType | null>(null);

const GEOFENCE_RADIUS_METERS = 300;
const TRACKING_STORAGE_KEY = 'driver-tracking-active';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ACTIVE_LOAD_STATUSES = ['dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];

// --- Wake Lock helpers (web only) ---
async function acquireWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  if (isNativePlatform()) return;
  try {
    if ('wakeLock' in navigator) {
      ref.current = await (navigator as any).wakeLock.request('screen');
    }
  } catch {
    // Wake Lock denied or not supported — non-critical
  }
}

function releaseWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  if (ref.current) {
    ref.current.release().catch(() => {});
    ref.current = null;
  }
}

export const DriverTrackingProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [nearbyStop, setNearbyStop] = useState<ActiveStop | null>(null);
  const [activeStops, setActiveStops] = useState<ActiveStop[]>([]);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef<GeolocationPosition | null>(null);
  const dismissedStopsRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nativeCleanupRef = useRef<(() => void) | null>(null);
  const [refreshStops, setRefreshStops] = useState(0);
  const autoResumedRef = useRef(false);

  // Check GPS permission status
  useEffect(() => {
    if (!('permissions' in navigator)) {
      setPermissionStatus('unknown');
      return;
    }
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermissionStatus(result.state as PermissionStatus);
      result.onchange = () => setPermissionStatus(result.state as PermissionStatus);
    }).catch(() => setPermissionStatus('unknown'));
  }, []);

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
    setSpeed(pos.coords.speed);
    setAccuracy(pos.coords.accuracy);
    checkGeofence(pos.coords.latitude, pos.coords.longitude);

    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId, checkGeofence]);

  // Send position from native tracking data (no GeolocationPosition object)
  const sendNativePosition = useCallback(async (pos: { lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null }) => {
    if (!driverId) return;
    const tenant_id = await getTenantId();
    const payload = {
      driver_id: driverId,
      tenant_id,
      lat: pos.lat,
      lng: pos.lng,
      speed: pos.speed,
      heading: pos.heading,
      accuracy: pos.accuracy,
      updated_at: new Date().toISOString(),
    };

    setLastPosition({ lat: pos.lat, lng: pos.lng });
    setSpeed(pos.speed);
    setAccuracy(pos.accuracy);
    checkGeofence(pos.lat, pos.lng);

    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId, checkGeofence]);

  const startWatchPosition = useCallback((onPosition: (pos: GeolocationPosition) => void) => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => { console.error('GPS error:', err); },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  const startTracking = useCallback((silent = false) => {
    if (tracking) return;

    if (isNativePlatform()) {
      // --- Native tracking via Capacitor plugin ---
      setTracking(true);
      localStorage.setItem(TRACKING_STORAGE_KEY, 'true');
      dismissedStopsRef.current.clear();
      if (!silent) toast({ title: 'GPS Tracking started' });

      // If watcher already active (survived background), just update state
      if (hasActiveWatcher()) {
        console.log('[Tracking] Watcher still alive, reconnecting state');
        return;
      }

      startNativeTracking((pos) => {
        sendNativePosition(pos);
      }).then((cleanup) => {
        nativeCleanupRef.current = cleanup;
      });
      return;
    }

    // --- Web tracking ---
    if (!('geolocation' in navigator)) {
      toast({ title: 'GPS not available', variant: 'destructive' });
      return;
    }

    setTracking(true);
    localStorage.setItem(TRACKING_STORAGE_KEY, 'true');
    dismissedStopsRef.current.clear();
    if (!silent) toast({ title: 'GPS Tracking started' });

    acquireWakeLock(wakeLockRef);
    startWatchPosition((pos) => { posRef.current = pos; sendPosition(pos); });

    intervalRef.current = setInterval(() => {
      if (posRef.current) sendPosition(posRef.current);
    }, 30000);
  }, [tracking, sendPosition, sendNativePosition, startWatchPosition]);

  const stopTracking = useCallback(() => {
    if (isNativePlatform()) {
      stopNativeTracking();
      if (nativeCleanupRef.current) {
        nativeCleanupRef.current();
        nativeCleanupRef.current = null;
      }
    } else {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      watchRef.current = null;
      intervalRef.current = null;
      releaseWakeLock(wakeLockRef);
    }

    setTracking(false);
    localStorage.removeItem(TRACKING_STORAGE_KEY);
    setNearbyStop(null);
    setActiveStops([]);
    toast({ title: 'GPS Tracking stopped' });
  }, []);

  // Auto-resume tracking from localStorage on mount
  useEffect(() => {
    if (autoResumedRef.current) return;
    if (!driverId) return;
    const wasTracking = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';
    if (wasTracking && !tracking) {
      autoResumedRef.current = true;
      setTimeout(() => startTracking(true), 500); // silent resume
    }
  }, [driverId]); // intentionally only depend on driverId

  // Native: listen for app state changes to reconnect tracking
  useEffect(() => {
    if (!isNativePlatform()) return;

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return; // going to background — native plugin handles it
      const shouldTrack = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';
      if (shouldTrack && !tracking) {
        // WebView was destroyed and recreated — re-establish tracking state
        startTracking(true);
      } else if (shouldTrack && tracking && !hasActiveWatcher()) {
        // Watcher was killed by OS — restart it
        startNativeTracking((pos) => {
          sendNativePosition(pos);
        }).then((cleanup) => {
          nativeCleanupRef.current = cleanup;
        });
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [tracking, sendNativePosition, startTracking]);

  // Web: Restore GPS watch + Wake Lock when app comes back to foreground
  useEffect(() => {
    if (isNativePlatform()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const shouldTrack = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';

        if (shouldTrack && !tracking) {
          startTracking(true);
          return;
        }

        if (tracking) {
          startWatchPosition((pos) => { posRef.current = pos; sendPosition(pos); });

          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            if (posRef.current) sendPosition(posRef.current);
          }, 30000);

          acquireWakeLock(wakeLockRef);
          if (posRef.current) sendPosition(posRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tracking, sendPosition, startWatchPosition, startTracking]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      releaseWakeLock(wakeLockRef);
    };
  }, []);

  return (
    <DriverTrackingContext.Provider value={{ tracking, lastPosition, speed, accuracy, permissionStatus, startTracking, stopTracking, nearbyStop, confirmArrival, dismissArrival }}>
      {children}
    </DriverTrackingContext.Provider>
  );
};

export const useDriverTracking = () => {
  const ctx = useContext(DriverTrackingContext);
  if (!ctx) throw new Error('useDriverTracking must be used within DriverTrackingProvider');
  return ctx;
};

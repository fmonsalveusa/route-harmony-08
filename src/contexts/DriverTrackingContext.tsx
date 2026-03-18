import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from '@/hooks/use-toast';
import { isNativePlatform, startNativeTracking, stopNativeTracking, isBackgroundGeolocationAvailable, isBatterySaverEnabled, setBatterySaver } from '@/lib/nativeTracking';
import { hapticFeedback } from '@/lib/haptics';
import { App as CapApp } from '@capacitor/app';

// --- Types ---

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
  paused: boolean;
  batterySaver: boolean;
  toggleBatterySaver: () => void;
  isEldTracked: boolean;
}

const DriverTrackingContext = createContext<DriverTrackingContextType | null>(null);

// --- Constants ---

const GEOFENCE_RADIUS_METERS = 300;
const TRACKING_STORAGE_KEY = 'driver-tracking-active';
const ACTIVE_LOAD_STATUSES = ['dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];
const IDLE_PAUSE_MS = 5 * 60 * 1000; // 5 minutes

// --- Helpers ---

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function acquireWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  if (isNativePlatform()) return;
  try {
    if ('wakeLock' in navigator) {
      ref.current = await (navigator as any).wakeLock.request('screen');
    }
  } catch { /* non-critical */ }
}

function releaseWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  if (ref.current) {
    ref.current.release().catch(() => {});
    ref.current = null;
  }
}

// --- Provider ---

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
  const [isEldTracked, setIsEldTracked] = useState(false);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef<GeolocationPosition | null>(null);
  const dismissedStopsRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nativeCleanupRef = useRef<(() => void) | null>(null);
  const [refreshStops, setRefreshStops] = useState(0);
  const autoResumedRef = useRef(false);
  const startingRef = useRef(false); // concurrency guard for startTracking


  // --- Idle pause state ---
  const [paused, setPaused] = useState(false);
  const lastMovementRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Battery saver state ---
  const [batterySaver, setBatterySaverState] = useState(isBatterySaverEnabled());

  const toggleBatterySaver = useCallback(() => {
    const newVal = !batterySaver;
    setBatterySaverState(newVal);
    setBatterySaver(newVal);
    toast({ title: newVal ? 'Modo ahorro activado 🔋' : 'Modo ahorro desactivado' });
  }, [batterySaver]);

  // --- Permission check ---
  useEffect(() => {
    if (!('permissions' in navigator)) { setPermissionStatus('unknown'); return; }
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermissionStatus(result.state as PermissionStatus);
      result.onchange = () => setPermissionStatus(result.state as PermissionStatus);
    }).catch(() => setPermissionStatus('unknown'));
  }, []);

  // --- Resolve driver ID ---
  useEffect(() => {
    if (!profile?.email) return;
    supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle().then(({ data }) => {
      if (data) setDriverId(data.id);
    });
  }, [profile?.email]);

  // --- Fetch active stops ---
  useEffect(() => {
    if (!driverId || !tracking) { setActiveStops([]); return; }

    const fetchActiveStops = async () => {
      const { data: loads } = await supabase.from('loads').select('id').eq('driver_id', driverId).in('status', ACTIVE_LOAD_STATUSES);
      if (!loads || loads.length === 0) { setActiveStops([]); return; }
      const loadIds = loads.map(l => l.id);
      const { data: stops } = await supabase.from('load_stops')
        .select('id, load_id, address, stop_type, stop_order, lat, lng')
        .in('load_id', loadIds).is('arrived_at', null).not('lat', 'is', null).not('lng', 'is', null);
      if (stops) setActiveStops(stops.filter(s => s.lat !== null && s.lng !== null) as ActiveStop[]);
    };
    fetchActiveStops();
  }, [driverId, tracking, refreshStops]);

  // --- Geofence check ---
  const checkGeofence = useCallback((lat: number, lng: number) => {
    if (activeStops.length === 0) return;
    for (const stop of activeStops) {
      if (dismissedStopsRef.current.has(stop.id)) continue;
      if (haversineDistance(lat, lng, stop.lat, stop.lng) <= GEOFENCE_RADIUS_METERS) {
        setNearbyStop(stop);
        hapticFeedback('alert');
        return;
      }
    }
  }, [activeStops]);

  // --- Confirm / dismiss arrival ---
  const confirmArrival = useCallback(async (stopId: string) => {
    const stop = activeStops.find(s => s.id === stopId);
    if (!stop) return;
    const { error } = await supabase.from('load_stops').update({ arrived_at: new Date().toISOString() } as any).eq('id', stopId);
    if (error) { toast({ title: 'Error marking arrival', variant: 'destructive' }); return; }

    const tenant_id = await getTenantId();
    const { data: loadData } = await supabase.from('loads').select('reference_number').eq('id', stop.load_id).single();
    const refNum = loadData?.reference_number || '';
    await supabase.from('notifications').insert({
      tenant_id, type: 'driver_arrived', title: 'Driver Arrived',
      message: `Driver arrived at ${stop.address} (Load ${refNum})`,
      load_id: stop.load_id, driver_id: driverId,
    } as any);

    dismissedStopsRef.current.add(stopId);
    setNearbyStop(null);
    setRefreshStops(prev => prev + 1);
    toast({ title: 'Llegada registrada ✓' });
  }, [activeStops, driverId]);

  const dismissArrival = useCallback(() => {
    if (nearbyStop) dismissedStopsRef.current.add(nearbyStop.id);
    setNearbyStop(null);
  }, [nearbyStop]);

  // ============================================================
  // IDLE DETECTION — auto-pause when speed is 0 for 5 minutes
  // ============================================================
  const handleIdleCheck = useCallback((currentSpeed: number | null) => {
    const isMoving = currentSpeed !== null && currentSpeed > 0.5; // > 0.5 m/s ≈ walking

    if (isMoving) {
      lastMovementRef.current = Date.now();
      if (paused) {
        console.log('[Tracking] Movement detected, resuming from idle pause');
        setPaused(false);
      }
      return;
    }

    // Not moving — check if idle long enough
    if (!paused && (Date.now() - lastMovementRef.current) >= IDLE_PAUSE_MS) {
      console.log('[Tracking] Idle for 5+ min, pausing DB updates');
      setPaused(true);
    }
  }, [paused]);

  // --- Send position (web GeolocationPosition) ---
  const sendPosition = useCallback(async (pos: GeolocationPosition) => {
    if (!driverId) return;
    setLastPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setSpeed(pos.coords.speed);
    setAccuracy(pos.coords.accuracy);
    checkGeofence(pos.coords.latitude, pos.coords.longitude);
    handleIdleCheck(pos.coords.speed);

    // Skip DB write if idle-paused
    if (paused) return;

    const tenant_id = await getTenantId();
    const payload = {
      driver_id: driverId, tenant_id,
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      speed: pos.coords.speed, heading: pos.coords.heading,
      accuracy: pos.coords.accuracy, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId, checkGeofence, handleIdleCheck, paused]);

  // --- Send position (native format) ---
  const sendNativePosition = useCallback(async (pos: { lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null }) => {
    if (!driverId) return;
    setLastPosition({ lat: pos.lat, lng: pos.lng });
    setSpeed(pos.speed);
    setAccuracy(pos.accuracy);
    checkGeofence(pos.lat, pos.lng);
    handleIdleCheck(pos.speed);

    // Skip DB write if idle-paused
    if (paused) return;

    const tenant_id = await getTenantId();
    const payload = {
      driver_id: driverId, tenant_id,
      lat: pos.lat, lng: pos.lng,
      speed: pos.speed, heading: pos.heading,
      accuracy: pos.accuracy, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('driver_locations').upsert(payload as any, { onConflict: 'driver_id' });
    if (error) console.error('Location update error:', error);
  }, [driverId, checkGeofence, handleIdleCheck, paused]);

  // --- Web watcher helper ---
  const startWatchPosition = useCallback((onPosition: (pos: GeolocationPosition) => void) => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => { console.error('GPS error:', err); },
      { enableHighAccuracy: !batterySaver, maximumAge: batterySaver ? 30000 : 10000 }
    );
  }, [batterySaver]);

  // ============================================================
  // START TRACKING
  // ============================================================
  const startTracking = useCallback(async (silent = false) => {
    if (tracking) return;
    if (startingRef.current) { console.log('[Tracking] startTracking already in progress, skipping'); return; }
    startingRef.current = true;

    try {
      console.log('[Tracking] startTracking called, silent:', silent, 'native:', isNativePlatform());
      lastMovementRef.current = Date.now();
      setPaused(false);

      if (isNativePlatform() && !silent) {
        try {
          let gpAvailable = true;
          if (!silent) {
            gpAvailable = await isBackgroundGeolocationAvailable();
          }

          if (gpAvailable) {
            console.log('[Tracking] Attempting NATIVE background geolocation, silent:', silent);
            try {
              const cleanup = await startNativeTracking((pos) => sendNativePosition(pos), !silent);
              nativeCleanupRef.current = cleanup;
              setTracking(true);
              localStorage.setItem(TRACKING_STORAGE_KEY, 'true');
              dismissedStopsRef.current.clear();
              if (!silent) { toast({ title: 'GPS Tracking started' }); hapticFeedback('medium'); }
              console.log('[Tracking] Native watcher established');
              return;
            } catch (e) {
              console.error('[Tracking] Native start failed, falling to web:', e);
            }
          } else {
            console.log('[Tracking] Native GPS not available, using web fallback');
          }
        } catch (e) {
          console.error('[Tracking] Native tracking crashed, falling to web:', e);
        }
      }

      // --- Web tracking fallback ---
      if (!('geolocation' in navigator)) {
        if (!silent) toast({ title: 'GPS not available', variant: 'destructive' });
        return;
      }
      console.log('[Tracking] Using WEB geolocation');
      setTracking(true);
      localStorage.setItem(TRACKING_STORAGE_KEY, 'true');
      dismissedStopsRef.current.clear();
      if (!silent) { toast({ title: 'GPS Tracking started' }); hapticFeedback('medium'); }

      acquireWakeLock(wakeLockRef);
      const updateInterval = batterySaver ? 60000 : 30000;
      startWatchPosition((pos) => { posRef.current = pos; sendPosition(pos); });
      intervalRef.current = setInterval(() => {
        if (posRef.current) sendPosition(posRef.current);
      }, updateInterval);
    } finally {
      startingRef.current = false;
    }
  }, [tracking, sendPosition, sendNativePosition, startWatchPosition, batterySaver]);

  // ============================================================
  // STOP TRACKING
  // ============================================================
  const stopTracking = useCallback(() => {
    console.log('[Tracking] stopTracking called');
    if (isNativePlatform()) {
      stopNativeTracking();
      if (nativeCleanupRef.current) { nativeCleanupRef.current(); nativeCleanupRef.current = null; }
    } else {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      watchRef.current = null;
      intervalRef.current = null;
      releaseWakeLock(wakeLockRef);
    }
    if (idleTimerRef.current) { clearInterval(idleTimerRef.current); idleTimerRef.current = null; }
    setTracking(false);
    setPaused(false);
    localStorage.removeItem(TRACKING_STORAGE_KEY);
    setNearbyStop(null);
    setActiveStops([]);
    hapticFeedback('medium');
    toast({ title: 'GPS Tracking stopped' });
  }, []);

  // ============================================================
  // AUTO-STOP when no active loads
  // ============================================================
  useEffect(() => {
    if (!driverId || !tracking) return;

    const checkInterval = setInterval(async () => {
      const { data } = await supabase.from('loads').select('id').eq('driver_id', driverId).in('status', ACTIVE_LOAD_STATUSES).limit(1);
      if (!data || data.length === 0) {
        console.log('[Tracking] No active loads, stopping tracking');
        stopTracking();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [driverId, tracking, stopTracking]);

  // ============================================================
  // AUTO-RESUME on mount (very defensive — wrapped in try-catch)
  // ============================================================
  useEffect(() => {
    if (autoResumedRef.current || !driverId) return;
    let isMounted = true;

    const safeAutoStart = async () => {
      if (!isMounted) return;
      try {
        console.log('[Tracking] safeAutoStart executing...');
        await startTracking(true);
      } catch (e) {
        console.error('[Tracking] Auto-start failed (caught):', e);
      }
    };

    const wasTracking = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';
    if (wasTracking && !tracking) {
      autoResumedRef.current = true;
      console.log('[Tracking] Auto-resuming from localStorage flag (12s delay)');
      const timer = setTimeout(() => safeAutoStart(), 12000);
      return () => { isMounted = false; clearTimeout(timer); };
    }

    if (!tracking) {
      const queryTimer = setTimeout(() => {
        if (!isMounted) return;
        supabase.from('loads').select('id').eq('driver_id', driverId).in('status', ACTIVE_LOAD_STATUSES).limit(1)
          .then(({ data, error }) => {
            if (error || !isMounted) { return; }
            if (data && data.length > 0 && !autoResumedRef.current) {
              autoResumedRef.current = true;
              console.log('[Tracking] Auto-starting: driver has active loads (12s delay)');
              setTimeout(() => safeAutoStart(), 6000);
            }
          });
      }, 6000);
      return () => { isMounted = false; clearTimeout(queryTimer); };
    }
  }, [driverId]); // intentionally only driverId

  // ============================================================
  // REALTIME: Auto-start tracking when a load is assigned
  // ============================================================
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-loads-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `driver_id=eq.${driverId}`,
        },
        async (payload) => {
          const newRecord = payload.new as any;
          if (!newRecord) return;

          const isActive = ACTIVE_LOAD_STATUSES.includes(newRecord.status);

          if (isActive && !tracking) {
            console.log('[Tracking] Realtime: new active load detected, auto-starting tracking');
            try {
              await startTracking(true);
            } catch (e) {
              console.error('[Tracking] Realtime auto-start failed:', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, tracking, startTracking]);

  // ============================================================
  // NATIVE: Reconnect on app resume (appStateChange)
  // ============================================================
  useEffect(() => {
    if (!isNativePlatform()) return;

    const listener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      const shouldTrack = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';
      if (!shouldTrack || tracking) return;

      console.log('[Tracking] App resumed, restoring tracking state via safe start');

      try {
        await startTracking(true);
      } catch (e) {
        console.error('[Tracking] Failed to restore tracking on resume:', e);
      }
    });

    return () => { listener.then(l => l.remove()); };
  }, [tracking, startTracking]);

  // ============================================================
  // WEB ONLY: Restore GPS watch on visibility change
  // ============================================================
  useEffect(() => {
    if (isNativePlatform()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const shouldTrack = localStorage.getItem(TRACKING_STORAGE_KEY) === 'true';

      if (shouldTrack && !tracking) { startTracking(true); return; }

      if (tracking) {
        startWatchPosition((pos) => { posRef.current = pos; sendPosition(pos); });
        if (intervalRef.current) clearInterval(intervalRef.current);
        const updateInterval = batterySaver ? 60000 : 30000;
        intervalRef.current = setInterval(() => { if (posRef.current) sendPosition(posRef.current); }, updateInterval);
        acquireWakeLock(wakeLockRef);
        if (posRef.current) sendPosition(posRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tracking, sendPosition, startWatchPosition, startTracking, batterySaver]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      releaseWakeLock(wakeLockRef);
    };
  }, []);

  return (
    <DriverTrackingContext.Provider value={{ tracking, lastPosition, speed, accuracy, permissionStatus, startTracking, stopTracking, nearbyStop, confirmArrival, dismissArrival, paused, batterySaver, toggleBatterySaver, isEldTracked }}>
      {children}
    </DriverTrackingContext.Provider>
  );
};

export const useDriverTracking = () => {
  const ctx = useContext(DriverTrackingContext);
  if (!ctx) throw new Error('useDriverTracking must be used within DriverTrackingProvider');
  return ctx;
};

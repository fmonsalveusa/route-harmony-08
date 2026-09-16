import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { MapPinOff, Settings, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  isNativePlatform,
  checkBackgroundPermissions,
  requestBackgroundPermissions,
  openLocationSettings,
  type BackgroundPermissionStatus,
} from '@/lib/nativeTracking';

/**
 * Avisa al driver cuando falta el permiso de ubicación en background y lo lleva
 * a concederlo. Sin ese permiso el tracking se corta al cerrar la app.
 *
 * Reporta el estado a la tabla drivers para que desde el TMS se vea quién lo
 * tiene concedido y quién no.
 */
export function GpsPermissionBanner({ driverId }: { driverId: string | null }) {
  const [status, setStatus] = useState<BackgroundPermissionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const lastReported = useRef<string>('');

  const report = useCallback(async (s: BackgroundPermissionStatus) => {
    if (!driverId) return;
    // Evita escribir lo mismo una y otra vez en cada resume
    const key = `${s.location}|${s.background}|${s.notification}`;
    if (lastReported.current === key) return;
    lastReported.current = key;

    // RPC con SECURITY DEFINER: identifica al driver por su sesión, sin depender del RLS de drivers
    const { data, error } = await supabase.rpc('report_gps_permissions' as any, {
      p_location: s.location,
      p_background: s.background,
      p_notification: s.notification,
    } as any);
    if (error) {
      console.error('[GpsPermissionBanner] report failed:', error);
      lastReported.current = '';
    } else if (!data) {
      console.warn('[GpsPermissionBanner] no driver matched the logged-in email');
    }
  }, [driverId]);

  const refresh = useCallback(async () => {
    if (!isNativePlatform()) return;
    const s = await checkBackgroundPermissions();
    setStatus(s);
    void report(s);
  }, [report]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Re-chequear al volver de Ajustes — ahí es donde el driver concede el permiso
  useEffect(() => {
    if (!isNativePlatform()) return;
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh();
    });
    return () => { listener.then(l => l.remove()); };
  }, [refresh]);

  const handleGrant = async () => {
    setRequesting(true);
    try {
      const s = await requestBackgroundPermissions();
      setStatus(s);
      void report(s);
      // Android 11+ suele negar sin mostrar diálogo — ahí solo sirve Ajustes
      if (!s.background) await openLocationSettings();
    } finally {
      setRequesting(false);
    }
  };

  if (!isNativePlatform() || !status || status.background || dismissed) return null;

  const noLocationAtAll = !status.location;

  return (
    <div className="mx-3 mt-2 p-3 rounded-lg border border-amber-400/50 bg-amber-50 shadow-md animate-in slide-in-from-top-2">
      <div className="flex items-start gap-2">
        <MapPinOff className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            El GPS se apaga al cerrar la app
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            {noLocationAtAll
              ? 'Activa el permiso de ubicación para poder registrar tus cargas.'
              : 'Falta elegir "Permitir todo el tiempo" para que el tracking siga con la app cerrada.'}
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleGrant} disabled={requesting}>
              {requesting
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                : <Settings className="h-3.5 w-3.5 mr-1" />}
              {requesting ? 'Abriendo...' : 'Activar'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-900" onClick={() => setDismissed(true)}>
              <X className="h-3.5 w-3.5 mr-1" />
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

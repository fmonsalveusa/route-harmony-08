import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MapPinOff, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  isNativePlatform,
  checkBackgroundPermissions,
  requestBackgroundPermissions,
  openLocationSettings,
  getAppVersion,
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
  const [pluginMissing, setPluginMissing] = useState(false);
  const [waitLeft, setWaitLeft] = useState(20);
  const lastReported = useRef<string>('');

  const report = useCallback(async (s: BackgroundPermissionStatus | null) => {
    if (!driverId) return;
    const version = await getAppVersion();
    // Evita escribir lo mismo una y otra vez en cada resume
    const key = `${s?.location}|${s?.background}|${s?.notification}|${version}`;
    if (lastReported.current === key) return;
    lastReported.current = key;

    // RPC con SECURITY DEFINER: identifica al driver por su sesión, sin depender del RLS de drivers.
    // Si no se pudo leer el permiso van en null: "no se sabe", distinto de "denegado".
    const { data, error } = await supabase.rpc('report_gps_status' as any, {
      p_location: s ? s.location : null,
      p_background: s ? s.background : null,
      p_notification: s ? s.notification : null,
      p_app_version: version,
      p_plugin_ok: s !== null,
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
    setPluginMissing(s === null);
    void report(s);
  }, [report]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Cuenta regresiva para poder seguir sin GPS
  const blocking = isNativePlatform() && !dismissed && (pluginMissing || (!!status && !status.background));
  useEffect(() => {
    if (!blocking || waitLeft <= 0) return;
    const t = setTimeout(() => setWaitLeft(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [blocking, waitLeft]);

  // Re-chequear al volver de Ajustes — ahí es donde el driver concede el permiso
  useEffect(() => {
    if (!isNativePlatform()) return;
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      // Al volver a la app el aviso aparece de nuevo si sigue faltando
      if (isActive) { setDismissed(false); setWaitLeft(20); void refresh(); }
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

  if (!isNativePlatform() || dismissed) return null;
  if (!pluginMissing && (!status || status.background)) return null;

  const ios = Capacitor.getPlatform() === 'ios';
  const steps = pluginMissing
    ? [
        `Abre ${ios ? 'App Store' : 'Play Store'} y busca "Dispatch Up".`,
        'Toca "Actualizar".',
        'Vuelve a abrir la app.',
      ]
    : ios
      ? ['Toca "Abrir ajustes".', 'Entra a "Ubicación".', 'Elige "Siempre".', 'Vuelve a la app.']
      : ['Toca "Abrir ajustes".', 'Entra a "Permisos" → "Ubicación".', 'Elige "Permitir todo el tiempo".', 'Vuelve a la app.'];

  // Pantalla completa: no se cierra hasta activarlo. Solo después de 20 s se puede seguir por ahora,
  // y vuelve a aparecer cada vez que se abre la app.
  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
            <MapPinOff className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-lg font-bold">{pluginMissing ? 'Actualiza la app' : 'Activa la ubicación "Siempre"'}</p>
          <p className="text-sm text-muted-foreground">
            {pluginMissing
              ? 'Tu versión es vieja y el GPS se apaga cuando cierras la app. Dispatch y el broker necesitan ver tu ubicación durante la carga.'
              : 'Sin este permiso el GPS se apaga cuando cierras la app, y dispatch y el broker dejan de ver tu ubicación.'}
          </p>
        </div>
        <ol className="space-y-1.5 text-sm">
          {steps.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        {pluginMissing ? (
          <Button className="w-full" onClick={() => void refresh()}>Ya la actualicé</Button>
        ) : (
          <Button className="w-full gap-2" onClick={handleGrant} disabled={requesting}>
            {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            {requesting ? 'Abriendo...' : 'Abrir ajustes'}
          </Button>
        )}
        <button
          type="button"
          className="w-full text-xs text-muted-foreground disabled:opacity-50"
          disabled={waitLeft > 0}
          onClick={() => setDismissed(true)}
        >
          {waitLeft > 0 ? `Continuar sin GPS (${waitLeft}s)` : 'Continuar sin GPS por ahora'}
        </button>
      </div>
    </div>
  );
}

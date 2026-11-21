import { useDriverTracking } from '@/contexts/DriverTrackingContext';
import { Switch } from '@/components/ui/switch';
import { Navigation, MapPin, Gauge, Crosshair, ShieldAlert, BatteryMedium, Pause, NavigationOff, Settings } from 'lucide-react';
import { isNativePlatform, openLocationSettings } from '@/lib/nativeTracking';
import { CARD, BTN_FILLED, BTN_TONAL } from '@/components/driver-app/driverUi';

function getAccuracyColor(accuracy: number | null) {
  if (accuracy === null) return 'text-[#444746]';
  if (accuracy <= 10) return 'text-[#0d652d]';
  if (accuracy <= 50) return 'text-[#8a5a00]';
  return 'text-[#b3261e]';
}

function getAccuracyLabel(accuracy: number | null) {
  if (accuracy === null) return '—';
  if (accuracy <= 10) return 'Excelente';
  if (accuracy <= 50) return 'Buena';
  return 'Baja';
}

export default function DriverTracking() {
  const { tracking, lastPosition, speed, accuracy, permissionStatus, startTracking, stopTracking, paused, batterySaver, toggleBatterySaver } = useDriverTracking();

  const speedMph = speed !== null && speed > 0 ? (speed * 2.237).toFixed(0) : '0';
  const denied = permissionStatus === 'denied';

  // Estado grande: verde activo, ámbar pausado, rojo apagado/denegado
  const state = denied
    ? { ring: 'bg-[#f9dedc]', dot: 'bg-[#d93025]', Icon: ShieldAlert, title: 'Ubicación denegada', sub: 'Dispatch no puede ver dónde estás. Activa el permiso de ubicación.' }
    : paused
      ? { ring: 'bg-[#fef7e0]', dot: 'bg-[#f9ab00]', Icon: Pause, title: 'GPS en pausa', sub: 'Estás detenido. Se reanuda solo al moverte.' }
      : tracking
        ? { ring: 'bg-[#c4eed0]', dot: 'bg-[#1e8e3e]', Icon: Navigation, title: 'GPS activo', sub: `Transmitiendo tu ubicación${batterySaver ? ' (ahorro de batería)' : ''}` }
        : { ring: 'bg-[#f9dedc]', dot: 'bg-[#d93025]', Icon: NavigationOff, title: 'GPS apagado', sub: 'Dispatch no ve tu ubicación. Actívalo para tus cargas.' };

  return (
    <div className="px-4 pt-2 pb-[calc(24px+env(safe-area-inset-bottom,0px))] space-y-4">
      <h1 className="text-[28px] leading-9 font-normal">GPS</h1>

      {/* Estado grande */}
      <div className={`${CARD} p-6 flex flex-col items-center text-center`}>
        <div className={`h-32 w-32 rounded-full flex items-center justify-center ${state.ring}`}>
          <div className={`h-20 w-20 rounded-full flex items-center justify-center text-white ${state.dot} ${tracking && !paused && !denied ? 'animate-pulse' : ''}`}>
            <state.Icon className="h-10 w-10" />
          </div>
        </div>
        <p className="text-[22px] leading-7 font-normal mt-4">{state.title}</p>
        <p className="text-sm text-[#444746] mt-1 max-w-[280px]">{state.sub}</p>

        <div className="w-full mt-5">
          {denied ? (
            isNativePlatform() ? (
              <button className={`${BTN_FILLED} w-full`} onClick={() => openLocationSettings()}>
                <Settings className="h-5 w-5" /> Abrir ajustes de ubicación
              </button>
            ) : (
              <p className="text-sm text-[#444746]">Habilita la ubicación en la configuración de tu navegador.</p>
            )
          ) : tracking ? (
            <button className={`${BTN_TONAL} w-full`} onClick={() => stopTracking()}>
              Detener GPS
            </button>
          ) : (
            <button className={`${BTN_FILLED} w-full`} onClick={() => startTracking()}>
              <Navigation className="h-5 w-5" /> Activar GPS
            </button>
          )}
          {permissionStatus === 'prompt' && !tracking && (
            <p className="text-xs text-[#444746] mt-2">Te pedirá permiso para usar tu ubicación.</p>
          )}
        </div>
      </div>

      {/* Ubicación actual */}
      {tracking && lastPosition && (
        <div className={`${CARD} p-5 space-y-3`}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0b57d0]" />
            <p className="text-sm font-medium">Ubicación actual</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#f0f4f9] p-3 flex items-center gap-3">
              <Gauge className="h-5 w-5 text-[#0b57d0]" />
              <div>
                <p className="text-xs text-[#444746]">Velocidad</p>
                <p className="text-base font-medium">{speedMph} mph</p>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f0f4f9] p-3 flex items-center gap-3">
              <Crosshair className={`h-5 w-5 ${getAccuracyColor(accuracy)}`} />
              <div>
                <p className="text-xs text-[#444746]">Precisión</p>
                <p className={`text-base font-medium ${getAccuracyColor(accuracy)}`}>
                  {accuracy !== null ? `${Math.round(accuracy)} m` : '—'} <span className="text-xs font-normal">({getAccuracyLabel(accuracy)})</span>
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#444746] font-mono">{lastPosition.lat.toFixed(5)}, {lastPosition.lng.toFixed(5)}</p>
        </div>
      )}

      {/* Ahorro de batería */}
      <div className={`${CARD} px-5 py-4 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <span className={`h-10 w-10 rounded-full flex items-center justify-center ${batterySaver ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#e9eef6] text-[#444746]'}`}>
            <BatteryMedium className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Ahorro de batería</p>
            <p className="text-xs text-[#444746]">{batterySaver ? 'Menor precisión, más batería' : 'Precisión máxima'}</p>
          </div>
        </div>
        <Switch checked={batterySaver} onCheckedChange={toggleBatterySaver} />
      </div>
    </div>
  );
}

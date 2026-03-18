import { useDriverTracking } from '@/contexts/DriverTrackingContext';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Navigation, MapPin, Gauge, Crosshair, Wifi, WifiOff, AlertTriangle, ShieldAlert, BatteryMedium, Pause, Radio } from 'lucide-react';

function getAccuracyColor(accuracy: number | null) {
  if (accuracy === null) return 'text-muted-foreground';
  if (accuracy <= 10) return 'text-success';
  if (accuracy <= 50) return 'text-yellow-500';
  return 'text-destructive';
}

function getAccuracyLabel(accuracy: number | null) {
  if (accuracy === null) return '—';
  if (accuracy <= 10) return 'Excelente';
  if (accuracy <= 50) return 'Buena';
  return 'Baja';
}

export default function DriverTracking() {
  const { tracking, lastPosition, speed, accuracy, permissionStatus, startTracking, stopTracking, paused, batterySaver, toggleBatterySaver, isEldTracked } = useDriverTracking();

  const speedKmh = speed !== null && speed > 0 ? (speed * 3.6).toFixed(0) : '0';
  const speedMph = speed !== null && speed > 0 ? (speed * 2.237).toFixed(0) : '0';

  if (isEldTracked) {
    return (
      <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-4">
        <h1 className="text-xl font-bold">GPS Tracking</h1>
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <Radio className="h-8 w-8 text-success" />
            </div>
            <p className="font-semibold text-lg">Tracked via ELD</p>
            <p className="text-sm text-muted-foreground">
              Tu ubicación se actualiza automáticamente a través del dispositivo ELD instalado en tu camión. No necesitas activar el GPS manual.
            </p>
          </CardContent>
        </Card>
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-0 right-0 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-success text-success-foreground z-10">
          <Radio className="h-3.5 w-3.5" />
          Rastreo ELD Activo
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-4">
      <h1 className="text-xl font-bold">GPS Tracking</h1>

      {/* Permission Alerts */}
      {permissionStatus === 'denied' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Ubicación denegada</AlertTitle>
          <AlertDescription>
            Debes habilitar los permisos de ubicación en la configuración de tu navegador para usar el rastreo GPS.
          </AlertDescription>
        </Alert>
      )}

      {permissionStatus === 'prompt' && !tracking && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Permiso requerido</AlertTitle>
          <AlertDescription>
            Al activar el rastreo, el navegador te pedirá permiso para acceder a tu ubicación.
          </AlertDescription>
        </Alert>
      )}

      {/* Tracking Status Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${tracking ? (paused ? 'bg-warning/20' : 'bg-success/20') : 'bg-muted'}`}>
                {paused ? (
                  <Pause className="h-6 w-6 text-warning" />
                ) : (
                  <Navigation className={`h-6 w-6 transition-colors ${tracking ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
                )}
              </div>
              <div>
                <p className="font-semibold text-base">
                  {paused ? 'Pausado (detenido)' : tracking ? 'Rastreo Activo' : 'Rastreo Inactivo'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {paused ? 'Se reanuda al moverte' : tracking ? 'Transmitiendo ubicación' : 'Activa para empezar a rastrear'}
                </p>
              </div>
            </div>
            <Switch
              checked={tracking}
              onCheckedChange={(checked) => checked ? startTracking() : stopTracking()}
              disabled={permissionStatus === 'denied'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Battery Saver Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${batterySaver ? 'bg-success/20' : 'bg-muted'}`}>
                <BatteryMedium className={`h-5 w-5 ${batterySaver ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-sm">Modo ahorro de batería</p>
                <p className="text-xs text-muted-foreground">
                  {batterySaver ? 'Menor precisión, más batería' : 'Precisión máxima'}
                </p>
              </div>
            </div>
            <Switch checked={batterySaver} onCheckedChange={toggleBatterySaver} />
          </div>
        </CardContent>
      </Card>

      {/* Location Card — only when tracking & has position */}
      {tracking && lastPosition && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">Ubicación Actual</p>
              {paused && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-medium">Pausado</span>
              )}
            </div>

            {/* Lat / Lng grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Latitud</p>
                <p className="font-mono text-sm font-medium">{lastPosition.lat.toFixed(6)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Longitud</p>
                <p className="font-mono text-sm font-medium">{lastPosition.lng.toFixed(6)}</p>
              </div>
            </div>

            {/* Speed & Accuracy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
                <Gauge className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Velocidad</p>
                  <p className="font-semibold text-sm">{speedMph} mph</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
                <Crosshair className={`h-5 w-5 ${getAccuracyColor(accuracy)}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Precisión</p>
                  <p className={`font-semibold text-sm ${getAccuracyColor(accuracy)}`}>
                    {accuracy !== null ? `${Math.round(accuracy)}m` : '—'}{' '}
                    <span className="font-normal text-xs">({getAccuracyLabel(accuracy)})</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Bar */}
      <div className={`fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-0 right-0 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors z-10 ${
        paused ? 'bg-warning text-warning-foreground' :
        tracking ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {paused ? (
          <>
            <Pause className="h-3.5 w-3.5" />
            Pausado — Detenido 5+ min
          </>
        ) : tracking ? (
          <>
            <Wifi className="h-3.5 w-3.5" />
            Conectado — Transmitiendo{batterySaver ? ' (ahorro)' : ''}
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            Desconectado
          </>
        )}
      </div>
    </div>
  );
}

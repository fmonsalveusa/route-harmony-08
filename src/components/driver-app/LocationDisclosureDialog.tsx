import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onLocationDisclosureRequest } from '@/lib/locationDisclosure';

/**
 * Aviso destacado antes de pedir el permiso de ubicación (requisito de Google Play).
 * Bilingüe: los drivers leen español y el revisor de Google, inglés.
 */
export function LocationDisclosureDialog() {
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    onLocationDisclosureRequest(resolve => setResolver(() => resolve));
    return () => onLocationDisclosureRequest(null);
  }, []);

  if (!resolver) return null;
  const answer = (ok: boolean) => { resolver(ok); setResolver(null); };

  return (
    <div className="fixed inset-0 z-[2100] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-bold">Uso de tu ubicación</p>
        </div>
        <p className="text-sm">
          <strong>Dispatch Up</strong> recopila tu ubicación para seguir tus cargas activas, detectar cuándo llegas a los
          pickups y entregas, y compartir tu posición con tu dispatcher y el broker,{' '}
          <strong>incluso cuando la app está cerrada o no la estás usando.</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Dispatch Up collects location data to track your active loads, detect when you arrive at pickups and
          deliveries, and share your position with your dispatcher and the broker,{' '}
          <strong>even when the app is closed or not in use.</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Tu ubicación no se usa para publicidad ni se vende. / Your location is not used for ads and is not sold.
        </p>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => answer(true)}>Continuar / Continue</Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => answer(false)}>Ahora no / Not now</Button>
        </div>
      </div>
    </div>
  );
}

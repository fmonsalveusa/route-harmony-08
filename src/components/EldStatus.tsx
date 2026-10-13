import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface EldStatus {
  /** own = cuenta propia del driver; company = cuentas de flota de la empresa */
  account: 'own' | 'company';
  provider: string;                 // HOS247 | RouteOne | Level ELD
  username: string | null;
  unit: string | null;
  ok: boolean;
  error: string | null;
  lastRead: string | null;          // última lectura del ELD (relojes o conexión)
}

const PROVIDER: Record<string, string> = { hos247: 'HOS247', routeone: 'RouteOne', leveleld: 'Level ELD' };

/** Qué drivers están conectados a un ELD y por qué cuenta (propia o de la empresa) */
export function useEldStatus() {
  return useQuery({
    queryKey: ['eld_status'],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: conns }, { data: clocks }, { data: locs }] = await Promise.all([
        // Solo los admin pueden leer las conexiones propias; para el resto llega vacío
        supabase.from('driver_eld_connections' as any).select('driver_id, provider, username, status, last_error, matched_unit, last_ok_at'),
        supabase.from('driver_hos_clocks' as any).select('driver_id, source, updated_at'),
        // Drivers que reciben ubicación del ELD de la empresa (p. ej. owner operators bajo nuestro MC)
        supabase.from('driver_locations').select('driver_id, source, updated_at').eq('source', 'eld'),
      ]);
      const map: Record<string, EldStatus> = {};
      for (const l of ((locs as any[]) ?? [])) {
        map[l.driver_id] = { account: 'company', provider: 'ELD', username: null, unit: null, ok: true, error: null, lastRead: l.updated_at };
      }
      for (const c of ((clocks as any[]) ?? [])) {
        map[c.driver_id] = { account: 'company', provider: c.source, username: null, unit: null, ok: true, error: null, lastRead: c.updated_at };
      }
      for (const c of ((conns as any[]) ?? [])) {
        map[c.driver_id] = {
          account: 'own', provider: PROVIDER[c.provider] ?? c.provider, username: c.username, unit: c.matched_unit,
          ok: c.status === 'ok', error: c.last_error, lastRead: map[c.driver_id]?.lastRead ?? c.last_ok_at,
        };
      }
      return map;
    },
  });
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

/** Etiqueta para la fila del driver */
export function EldBadge({ status }: { status?: EldStatus }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        status.ok ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      }`}
      title={`${status.provider} · ${status.account === 'own' ? 'cuenta propia' : 'cuenta de la empresa'}${status.ok ? '' : ` · Error: ${status.error ?? ''}`}`}
    >
      <Radio className="h-3 w-3" /> ELD
    </span>
  );
}

/** Bloque del perfil del driver */
export function EldInfo({ status }: { status?: EldStatus }) {
  return (
    <div className="border-t pt-3 space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Radio className="h-3.5 w-3.5" /> ELD Connection</p>
      {!status ? (
        <p className="text-sm text-muted-foreground">No conectado</p>
      ) : (
        <div className="text-sm space-y-0.5">
          <p className="font-medium">
            {status.provider} · {status.account === 'own' ? 'Cuenta propia' : 'Cuenta de la empresa'}
            <span className={`ml-2 text-xs ${status.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
              {status.ok ? '● Conectado' : '● Error'}
            </span>
          </p>
          {status.username && <p className="text-xs text-muted-foreground">Usuario: {status.username}</p>}
          {status.unit && <p className="text-xs text-muted-foreground">Unidad en el ELD: {status.unit}</p>}
          {status.lastRead && <p className="text-xs text-muted-foreground">Última lectura: {ago(status.lastRead)}</p>}
          {!status.ok && status.error && <p className="text-xs text-destructive">{status.error}</p>}
        </div>
      )}
    </div>
  );
}

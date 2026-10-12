import { useCallback, useEffect, useState } from 'react';
import { Radio, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Conn {
  provider: 'hos247' | 'routeone';
  username: string;
  status: 'pending' | 'ok' | 'error';
  last_error: string | null;
  matched_unit: string | null;
  last_ok_at: string | null;
  secret_id: string | null;
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('eld-connections', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}

/**
 * Conexión ELD propia del driver (su usuario de HOS247 o RouteOne). Solo admin.
 * Sin conexión, el driver se lee de las cuentas de flota de la empresa.
 * La contraseña va directo a la bóveda cifrada; aquí nunca se vuelve a mostrar.
 */
export function EldConnectionSection({ driverId }: { driverId: string }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [provider, setProvider] = useState<string>('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('driver_eld_connections' as any)
      .select('provider, username, status, last_error, matched_unit, last_ok_at, secret_id').eq('driver_id', driverId).maybeSingle();
    const c = (data as unknown as Conn) ?? null;
    setConn(c);
    setProvider(c?.provider ?? 'none');
    setUsername(c?.username ?? '');
    setPassword('');
  }, [driverId]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: 'save' | 'test' | 'delete') => {
    if (action === 'delete' && !window.confirm('¿Quitar la conexión ELD de este driver? Volverá a leerse con las cuentas de la empresa.')) return;
    setBusy(action);
    try {
      const r = await call({ action, driver_id: driverId, provider, username, password: password || undefined });
      if (action === 'delete') toast.success('Conexión ELD eliminada');
      else if (r.ok) toast.success(`Conectado ✓${r.matched_unit ? ` · Unidad ${r.matched_unit}` : r.units?.length ? ` · Unidades: ${r.units.join(', ')}` : ''}`);
      else toast.error(`No se pudo conectar: ${r.error}`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const changed = provider !== (conn?.provider ?? 'none') || username !== (conn?.username ?? '') || !!password;

  return (
    <div className="space-y-3 p-3 rounded-lg border-2 border-teal-400/50 bg-teal-50 dark:bg-teal-950/20 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
          <Radio className="h-4 w-4" /> Conexión ELD
        </Label>
        {conn && (
          conn.status === 'ok'
            ? <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Conectado{conn.matched_unit ? ` · Unidad ${conn.matched_unit}` : ''}{conn.last_ok_at ? ` · ${ago(conn.last_ok_at)}` : ''}
              </span>
            : conn.status === 'error'
              ? <span className="text-xs text-destructive flex items-center gap-1" title={conn.last_error ?? ''}>
                  <AlertTriangle className="h-3.5 w-3.5" /> Error: {(conn.last_error ?? '').slice(0, 60)}
                </span>
              : <span className="text-xs text-muted-foreground">Sin probar</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Proveedor</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno (cuentas de la empresa)</SelectItem>
              <SelectItem value="hos247">HOS247</SelectItem>
              <SelectItem value="routeone">RouteOne</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {provider !== 'none' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Usuario</Label>
              <Input className="h-9" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contraseña</Label>
              <Input
                className="h-9" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"
                placeholder={conn?.secret_id ? '•••••• (guardada — escribe para cambiarla)' : ''}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {provider !== 'none' && (
          <Button type="button" size="sm" onClick={() => run('save')} disabled={busy !== null || !username.trim() || (!password && !conn?.secret_id) || !changed}>
            {busy === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Guardar y probar
          </Button>
        )}
        {conn && provider === conn.provider && !changed && (
          <Button type="button" size="sm" variant="outline" onClick={() => run('test')} disabled={busy !== null}>
            {busy === 'test' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Probar conexión
          </Button>
        )}
        {conn && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => run('delete')} disabled={busy !== null}>
            <Trash2 className="h-3.5 w-3.5" /> Quitar
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Solo si el driver usa su propia cuenta de HOS247 o RouteOne. La contraseña se guarda cifrada y no se vuelve a mostrar.
        Con la conexión, su ubicación se lee cada 2 minutos y sus relojes HOS cada hora.
      </p>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { FileSignature, Loader2, Eye, Send, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RcSigned {
  status: 'draft' | 'sent' | 'failed';
  file_path: string | null;
  placement: { placed?: { field: string }[]; already_signed?: boolean } | null;
  driver_name: string | null;
  error: string | null;
  sent_to: string | null;
  prepared_at: string | null;
  sent_at: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  carrier_signature: 'firma', signer_name: 'nombre', signer_title: 'cargo', sign_date: 'fecha',
  driver_name: 'driver', driver_phone: 'teléfono', truck_number: 'camión',
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' });

async function callRc(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('broker-email', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}

/** Rate confirmation firmado por la empresa con los datos del driver: revisar y devolver al broker */
export function RcSignedSection({ loadId, hasDriver }: { loadId: string; hasDriver: boolean }) {
  const [rc, setRc] = useState<RcSigned | null>(null);
  const [busy, setBusy] = useState<'prepare' | 'send' | 'view' | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('load_rc_signed' as any).select('*').eq('load_id', loadId).maybeSingle();
    setRc((data as unknown as RcSigned) ?? null);
  }, [loadId]);

  useEffect(() => { load(); }, [load]);

  const prepare = async () => {
    if (rc?.status === 'sent' && !window.confirm('Este RC ya se envió al broker. ¿Prepararlo de nuevo?')) return;
    setBusy('prepare');
    try {
      await callRc({ action: 'rc_prepare', load_id: loadId, force: rc?.status === 'sent' });
      toast.success('RC firmado listo para revisar');
      await load();
    } catch (e: any) {
      toast.error(e.message);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const view = async () => {
    if (!rc?.file_path) return;
    setBusy('view');
    const { data, error } = await supabase.storage.from('driver-documents').createSignedUrl(rc.file_path, 3600);
    setBusy(null);
    if (error || !data?.signedUrl) { toast.error('No se pudo abrir el PDF'); return; }
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.signedUrl });
    else window.open(data.signedUrl, '_blank');
  };

  const send = async () => {
    if (!window.confirm('¿Enviar el RC firmado al broker? Revisa primero que la firma y los datos estén bien ubicados.')) return;
    setBusy('send');
    try {
      const r = await callRc({ action: 'rc_send', load_id: loadId });
      toast.success('RC firmado enviado al broker', { description: r.to });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const placed = (rc?.placement?.placed ?? []).map(p => FIELD_LABELS[p.field] ?? p.field);

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="font-semibold flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5 text-primary" /> Rate confirmation firmado
        </h5>
        {rc?.status === 'sent' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Enviado</span>}
        {rc?.status === 'draft' && <span className="text-xs text-amber-600">Pendiente de revisar</span>}
      </div>

      {!rc && <p className="text-xs text-muted-foreground">
        {hasDriver ? 'Todavía no se ha preparado.' : 'Asigna un driver para preparar el RC firmado.'}
      </p>}

      {rc?.status === 'failed' && (
        <p className="text-xs text-destructive flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {rc.error}</p>
      )}

      {rc?.file_path && rc.status !== 'failed' && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {rc.prepared_at && <p>Preparado {fmt(rc.prepared_at)}{rc.driver_name ? ` con ${rc.driver_name}` : ''}.</p>}
          {placed.length > 0 && <p>Se llenó: {placed.join(', ')}.</p>}
          {rc.placement && !(rc.placement.placed ?? []).some(p => p.field === 'carrier_signature') && !rc.placement.already_signed && (
            <p className="text-amber-600">No encontré la línea de firma: se agregó una hoja de aceptación al final.</p>
          )}
          {rc.placement?.already_signed && <p className="text-amber-600">El RC ya traía una firma en la línea del carrier: no se volvió a firmar.</p>}
          {rc.status === 'sent' && rc.sent_at && <p>Enviado {fmt(rc.sent_at)}{rc.sent_to ? ` a ${rc.sent_to}` : ''}.</p>}
          {rc.error && rc.status === 'draft' && <p className="text-destructive">Último intento de envío: {rc.error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {rc?.file_path && rc.status !== 'failed' && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={view} disabled={busy !== null}>
            {busy === 'view' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Ver
          </Button>
        )}
        {hasDriver && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={prepare} disabled={busy !== null}>
            {busy === 'prepare' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            {rc ? 'Volver a preparar' : 'Preparar'}
          </Button>
        )}
        {rc?.status === 'draft' && rc.file_path && (
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={send} disabled={busy !== null}>
            {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar al broker
          </Button>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { FileSignature, Loader2, Eye, Send, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

/**
 * Segundo paso al guardar una carga: muestra el RC firmado apenas está listo para revisarlo y enviarlo.
 * `preparing` es la llamada a rc_prepare que lanzó el formulario.
 */
export function RcReviewDialog({ loadId, reference, preparing, onClose }: {
  loadId: string;
  reference?: string;
  preparing: Promise<{ data: any; error: any }>;
  onClose: () => void;
}) {
  const [state, setState] = useState<'preparing' | 'ready' | 'error' | 'sent'>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await preparing;
      if (cancelled) return;
      let message: string | null = data?.error ?? null;
      if (!message && err) {
        const detail = await (err as any).context?.json?.().catch(() => null);
        message = detail?.error ?? err.message;
      }
      if (message) { setError(message); setState('error'); return; }
      const { data: row } = await supabase.from('load_rc_signed' as any).select('file_path').eq('load_id', loadId).maybeSingle();
      const path = (row as any)?.file_path;
      const signed = path ? await supabase.storage.from('driver-documents').createSignedUrl(path, 3600) : null;
      if (cancelled) return;
      if (!signed?.data?.signedUrl) { setError('No se pudo abrir el RC firmado'); setState('error'); return; }
      setUrl(signed.data.signedUrl);
      setState('ready');
    })();
    return () => { cancelled = true; };
  }, [loadId, preparing]);

  const send = async () => {
    setSending(true);
    try {
      const r = await callRc({ action: 'rc_send', load_id: loadId });
      toast.success('RC firmado enviado al broker', { description: r.to });
      setState('sent');
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Rate confirmation firmado{reference ? ` · #${reference}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg border bg-muted/30 overflow-hidden">
          {state === 'preparing' && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" /> Firmando y llenando los datos del driver… (20-30 segundos)
            </div>
          )}
          {state === 'error' && (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-sm text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">La carga quedó guardada. Puedes prepararlo de nuevo desde su detalle.</p>
            </div>
          )}
          {state !== 'preparing' && state !== 'error' && url && (
            <iframe src={url} title="RC firmado" className="w-full h-full" />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {state === 'ready' ? 'Revisa que la firma y los datos del driver estén en su lugar.' : 'Si lo cierras, lo encuentras en el detalle de la carga.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{state === 'ready' ? 'Enviar después' : 'Cerrar'}</Button>
            {state === 'ready' && (
              <Button onClick={send} disabled={sending} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar al broker
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

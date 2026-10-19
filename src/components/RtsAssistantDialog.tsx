import { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from 'sonner';

/**
 * Asistente de factoring RTS: clave para la extensión de Chrome que llena las facturas en el portal
 * de RTS con las cargas en Factoring "Pending" (RC + POD de cada entrega). Solo admins.
 */
export function RtsAssistantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const tenantId = await getTenantId();
      const { data } = await supabase.from('integration_keys' as any).select('key').eq('kind', 'rts_assistant').eq('tenant_id', tenantId).maybeSingle();
      if (data) { setKey((data as any).key); return; }
      const { data: created, error } = await supabase.from('integration_keys' as any)
        .insert({ tenant_id: tenantId, kind: 'rts_assistant' } as any).select('key').single();
      if (error) toast.error(`No se pudo crear la clave: ${error.message}`);
      else setKey((created as any).key);
    })();
  }, [open]);

  const regenerate = async () => {
    if (!window.confirm('La clave actual dejará de funcionar y habrá que pegar la nueva en cada computadora. ¿Continuar?')) return;
    setBusy(true);
    const tenantId = await getTenantId();
    await supabase.from('integration_keys' as any).delete().eq('kind', 'rts_assistant').eq('tenant_id', tenantId);
    const { data, error } = await supabase.from('integration_keys' as any)
      .insert({ tenant_id: tenantId, kind: 'rts_assistant' } as any).select('key').single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setKey((data as any).key);
    toast.success('Clave nueva creada');
  };

  const copy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asistente de factoring RTS</DialogTitle>
          <DialogDescription>
            Extensión de Chrome que llena las facturas en el portal de RTS con las cargas entregadas en Factoring "Pending":
            número de carga, broker, monto, RC y el POD de cada entrega.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>
            Descarga la extensión y descomprímela en una carpeta fija.{' '}
            <a className="inline-flex items-center gap-1 text-primary underline" href="/downloads/rts-factoring-assistant.zip" download>
              <Download className="h-3.5 w-3.5" /> rts-factoring-assistant.zip
            </a>
          </li>
          <li>En Chrome abre <code>chrome://extensions</code>, activa <b>Modo de desarrollador</b> y pulsa <b>Cargar descomprimida</b> con esa carpeta.</li>
          <li>En el portal de RTS (Factoring → Invoices) pulsa <b>Llenar desde Dispatch Up</b> y, la primera vez, pega esta clave:</li>
        </ol>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded border bg-muted px-2 py-1.5 text-xs">{key ?? '…'}</code>
          <Button size="sm" variant="outline" onClick={copy} disabled={!key}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={regenerate} disabled={busy} title="Crear una clave nueva (la actual deja de funcionar)">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La clave da acceso a las cargas por facturar y sus documentos: no la compartas fuera del equipo. Al enviar a RTS,
          el asistente marca esas cargas en Factoring <b>Ready</b> (eso genera los pagos, como hoy).
        </p>
      </DialogContent>
    </Dialog>
  );
}

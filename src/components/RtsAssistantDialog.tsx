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
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/downloads/extensions.json?t=${Date.now()}`)
      .then(r => r.json()).then(d => setVersion(d?.rts?.version ?? null)).catch(() => setVersion(null));
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
      <DialogContent className="max-w-xl w-[calc(100vw-32px)] overflow-hidden [&>*]:min-w-0 rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Asistente de factoring RTS</DialogTitle>
          <DialogDescription className="text-sm text-[#444746] dark:text-muted-foreground">
            Extensión de Chrome que llena las facturas en el portal de RTS con las cargas entregadas en Factoring "Pending":
            número de carga, broker, monto, RC y el POD de cada entrega.
          </DialogDescription>
        </DialogHeader>
        <a
          href="/downloads/rts-factoring-assistant.zip"
          download
          className="flex items-center gap-3 rounded-2xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3 hover:bg-[#f0f4f9] dark:hover:bg-muted/40 transition-colors"
        >
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] text-[#041e49] flex items-center justify-center"><Download className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-[#1f1f1f] dark:text-foreground">rts-factoring-assistant.zip</span>
            <span className="block text-xs text-[#444746] dark:text-muted-foreground">{version ? `Versión ${version} · siempre la más reciente` : 'Siempre la versión más reciente'}</span>
          </span>
          <span className="text-sm font-medium text-[#0b57d0] dark:text-blue-300">Descargar</span>
        </a>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Descomprime el zip en una carpeta fija (por ejemplo <b>Documentos</b>). No la borres ni la muevas después.</li>
          <li>En Chrome abre <code>chrome://extensions</code>, activa <b>Modo de desarrollador</b> y pulsa <b>Cargar descomprimida</b> con esa carpeta.</li>
          <li>En el portal de RTS (Factoring → Invoices) pulsa <b>Llenar desde Dispatch Up</b> y, la primera vez, pega esta clave:</li>
        </ol>
        <div className="flex items-center gap-2 min-w-0">
          <code className="flex-1 min-w-0 truncate rounded border bg-muted px-2 py-1.5 text-xs">{key ?? '…'}</code>
          <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" size="sm" variant="outline" onClick={copy} disabled={!key}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button className="rounded-full text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" size="sm" variant="ghost" onClick={regenerate} disabled={busy} title="Crear una clave nueva (la actual deja de funcionar)">
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

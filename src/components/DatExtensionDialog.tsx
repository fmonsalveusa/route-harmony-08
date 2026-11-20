import { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

/**
 * Extensión de Chrome para DAT One: nombres de driver en las pestañas, llamadas por Google Voice,
 * rating de RTS por MC y email al broker. Se descarga desde aquí; el zip se regenera en cada deploy.
 */
export function DatExtensionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [version, setVersion] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/downloads/extensions.json?t=${Date.now()}`)
      .then(r => r.json()).then(d => setVersion(d?.dat?.version ?? null)).catch(() => setVersion(null));
    (async () => {
      const tenantId = await getTenantId();
      const { data } = await supabase.from('integration_keys' as any).select('key').eq('kind', 'rts_assistant').eq('tenant_id', tenantId).maybeSingle();
      setKey((data as any)?.key ?? null);
    })();
  }, [open]);

  const copy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Extensión de DAT</DialogTitle>
          <DialogDescription className="text-sm text-[#444746] dark:text-muted-foreground">
            Para DAT One: nombre del driver en cada pestaña, llamadas por Google Voice, rating de RTS de cada broker
            y botón para enviarle email al broker con tu plantilla.
          </DialogDescription>
        </DialogHeader>

        <a
          href="/downloads/dat-driver-tabs.zip"
          download
          className="flex items-center gap-3 rounded-2xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3 hover:bg-[#f0f4f9] dark:hover:bg-muted/40 transition-colors"
        >
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] text-[#041e49] flex items-center justify-center"><Download className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-[#1f1f1f] dark:text-foreground">dat-driver-tabs.zip</span>
            <span className="block text-xs text-[#444746] dark:text-muted-foreground">{version ? `Versión ${version} · siempre la más reciente` : 'Siempre la versión más reciente'}</span>
          </span>
          <span className="text-sm font-medium text-[#0b57d0] dark:text-blue-300">Descargar</span>
        </a>

        <div className="space-y-2 text-sm">
          <p className="font-medium text-[#1f1f1f] dark:text-foreground">Instalar (una vez por computadora)</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-[#1f1f1f] dark:text-foreground">
            <li>Descomprime el zip en una carpeta fija (por ejemplo <b>Documentos</b>). No la borres ni la muevas después.</li>
            <li>En Chrome abre <code>chrome://extensions</code>, activa <b>Modo de desarrollador</b> y pulsa <b>Cargar descomprimida</b> con la carpeta <b>dat-driver-tabs</b>.</li>
            <li>Abre <code>rtspro.com/credit</code> con la sesión de RTS (para los ratings; una vez al día).</li>
            <li>Si Chrome no tiene la cuenta de 58 Logistics sincronizada: en DAT abre una carga, pulsa <b>⚙</b> y pega esta clave → Probar → Guardar.</li>
          </ol>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-[#c4c7c5] bg-white dark:bg-card px-2 py-1.5 text-xs">{key ?? '…'}</code>
          <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" size="sm" variant="outline" onClick={copy} disabled={!key}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/30 px-4 py-3 text-xs text-[#0d652d] dark:text-emerald-200">
          <b>Actualizaciones:</b> cuando haya una versión nueva, DAT muestra un aviso arriba con el botón <b>Descargar</b>.
          Descomprímela encima de la misma carpeta (reemplazando los archivos) y pulsa ↻ en <code>chrome://extensions</code>.
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Visor de PDF dentro del TMS. Abrir en otra pestaña manda el archivo a la ventana/perfil
 * de Chrome por defecto (no necesariamente la sesión donde está el TMS).
 */
export function PdfViewerDialog({ url, title, onClose }: { url: string | null; title: string; onClose: () => void }) {
  return (
    <Dialog open={!!url} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {url && <iframe src={url} title={title} className="flex-1 min-h-0 w-full rounded border" />}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Para descargar o imprimir, usa los botones del visor.</p>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

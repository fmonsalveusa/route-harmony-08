import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Visor de PDF dentro del TMS. Abrir en otra pestaña manda el archivo a la ventana/perfil
 * de Chrome por defecto (no necesariamente la sesión donde está el TMS).
 */
export function PdfViewerDialog({ url, title, onClose }: { url: string | null; title: string; onClose: () => void }) {
  return (
    <Dialog open={!!url} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col gap-3 rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{title}</DialogTitle>
        </DialogHeader>
        {url && <iframe src={url} title={title} className="flex-1 min-h-0 w-full rounded border" />}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Para descargar o imprimir, usa los botones del visor.</p>
          <Button className="rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

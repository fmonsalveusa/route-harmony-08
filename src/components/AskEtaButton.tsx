import { useEffect, useState } from 'react';
import { Clock, Send, Loader2, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Botón "ETA" en el badge del driver (Tracking): manda a su grupo de WhatsApp la pregunta
 * de a qué hora estima llegar a la siguiente parada. El mensaje se puede editar antes de enviar.
 */
export const AskEtaButton = ({ driverName, stopCity, groupId, groupName }: {
  driverName: string; stopCity: string; groupId?: string | null; groupName?: string | null;
}) => {
  const firstName = (driverName || '').trim().split(/\s+/)[0] || '';
  const defaultText = `Hola ${firstName}, ¿a qué hora estimas la llegada a la parada en ${stopCity}?`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultText);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { if (open) { setText(defaultText); setSent(false); } }, [open, defaultText]);

  const send = async () => {
    if (!groupId || !text.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-groups', {
        body: { action: 'broadcast', group_ids: [{ id: groupId, name: groupName || '' }], message: text.trim() },
      });
      if (error || data?.error || (data?.failed?.length ?? 0) > 0) {
        throw new Error(data?.error || data?.failed?.[0]?.error || error?.message || 'No se pudo enviar');
      }
      setSent(true);
      toast.success('Pregunta de ETA enviada al grupo');
      setTimeout(() => setOpen(false), 900);
    } catch (e: any) {
      toast.error('No se pudo enviar', { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#c4c7c5] dark:border-border px-2 py-0.5 text-[11px] font-medium text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-blue-900/30 transition-colors"
          title="Pedir ETA por WhatsApp"
        >
          <Clock className="h-3 w-3" /> ETA
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-[#1f1f1f] dark:text-foreground">Pedir ETA</p>
        <p className="mt-0.5 text-[11px] text-[#444746] dark:text-muted-foreground">Se envía al grupo de WhatsApp del driver</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-3 text-xs rounded-xl" />
        {groupId ? (
          <button
            type="button"
            onClick={send}
            disabled={sending || sent || !text.trim()}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0b57d0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:opacity-60 transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sent ? 'Enviado' : `Enviar a ${groupName || 'su grupo de WhatsApp'}`}
          </button>
        ) : (
          <p className="mt-2 text-[11px] text-[#c5221f]">Este driver no tiene grupo de WhatsApp asignado (Drivers → editar).</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

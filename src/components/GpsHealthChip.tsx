import { useEffect, useState } from 'react';
import { Satellite, Truck, MapPinOff, AlertCircle, Send, Loader2, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GpsHealth } from '@/lib/gpsHealth';

const STYLE: Record<GpsHealth['level'], { cls: string; Icon: typeof Satellite }> = {
  ok: { cls: 'bg-[#e6f4ea] text-[#137333] dark:bg-emerald-900/40 dark:text-emerald-200', Icon: Satellite },
  eld: { cls: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200', Icon: Truck },
  warn: { cls: 'bg-[#feefc3] text-[#7a4f01] dark:bg-amber-900/40 dark:text-amber-200', Icon: MapPinOff },
  error: { cls: 'bg-[#fce8e6] text-[#c5221f] dark:bg-red-900/40 dark:text-red-200', Icon: AlertCircle },
};

/**
 * Chip con el estado del GPS del driver. Al pulsarlo muestra el motivo y, si hay algo que
 * arreglar, el mensaje con las instrucciones para enviarlo a su grupo de WhatsApp.
 */
export const GpsHealthChip = ({ health, groupId, groupName }: { health: GpsHealth; groupId?: string | null; groupName?: string | null }) => {
  const { cls, Icon } = STYLE[health.level];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(health.fix || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { if (open) { setText(health.fix || ''); setSent(false); } }, [open, health.fix]);

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
      toast.success('Instrucciones enviadas al grupo');
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
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold hover:brightness-95 transition ${cls}`}
          title={health.detail}
        >
          <Icon className="h-3 w-3" /> {health.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className={`h-7 w-7 rounded-full flex items-center justify-center ${cls}`}><Icon className="h-3.5 w-3.5" /></span>
          <p className="text-sm font-medium text-[#1f1f1f] dark:text-foreground">{health.label}</p>
        </div>
        <p className="mt-2 text-xs text-[#444746] dark:text-muted-foreground">{health.detail}</p>
        {health.fix && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-medium text-[#444746] dark:text-muted-foreground">Mensaje para el driver</p>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="text-xs rounded-xl" />
            {groupId ? (
              <button
                type="button"
                onClick={send}
                disabled={sending || sent || !text.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0b57d0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:opacity-60 transition-colors"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {sent ? 'Enviado' : `Enviar a ${groupName || 'su grupo de WhatsApp'}`}
              </button>
            ) : (
              <p className="text-[11px] text-[#c5221f]">Este driver no tiene grupo de WhatsApp asignado (Drivers → editar).</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

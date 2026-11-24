import { useState } from 'react';
import { Mail, Send, Loader2, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { MAPBOX_TOKEN } from '@/lib/mapConfig';
import { toast } from 'sonner';

const cityState = (address: string) => {
  const parts = (address || '').split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return address || '';
  return `${parts[parts.length - 2]}, ${parts[parts.length - 1].replace(/\d{5}(-\d{4})?/, '').replace(/\b(USA|US|United States)\b/i, '').trim()}`.replace(/,\s*$/, '');
};

/** Ciudad, estado de una coordenada (Mapbox reverse) */
async function reverseCity(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&access_token=${MAPBOX_TOKEN}`);
    const j = await r.json();
    const f = j?.features?.[0];
    if (!f) return null;
    const region = (f.context || []).find((c: any) => String(c.id).startsWith('region'));
    const st = String(region?.short_code || '').replace(/^US-/i, '');
    return st ? `${f.text}, ${st}` : f.text;
  } catch {
    return null;
  }
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

/**
 * Botón "Broker" en la tarjeta del driver (Tracking): responde en el hilo de Gmail del broker con
 * la ubicación actual del truck y el ETA a la siguiente parada. El texto se revisa antes de enviar.
 */
export const BrokerUpdateButton = ({ load, stop, miles, etaLabel, loc, lastSentAt, onSent }: {
  load: { id: string; reference_number: string; company_id?: string | null };
  stop: { address: string; stop_type: string } | null;
  miles: number | null;
  etaLabel: string | null;
  loc: { lat: number; lng: number } | null;
  lastSentAt?: string | null;
  onSent?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentNow, setSentNow] = useState<string | null>(null);
  const lastAt = sentNow && (!lastSentAt || sentNow > lastSentAt) ? sentNow : lastSentAt ?? null;

  const prepare = async () => {
    setPreparing(true);
    setSent(false);
    try {
      const [near, company] = await Promise.all([
        loc ? reverseCity(loc.lat, loc.lng) : Promise.resolve(null),
        load.company_id
          ? supabase.from('companies').select('name').eq('id', load.company_id).maybeSingle().then(({ data }) => (data as any)?.name ?? '')
          : Promise.resolve(''),
      ]);
      const kind = stop?.stop_type === 'pickup' ? 'pickup' : 'delivery';
      const dest = stop ? cityState(stop.address) : '';
      const where = near
        ? `Our driver is currently near ${near}${miles != null && dest ? `, ${Math.round(miles)} mi from the ${kind} in ${dest}` : ''}.`
        : dest ? `Our driver is on the way to the ${kind} in ${dest}.` : 'Our driver is on the way.';
      setText(
        `Hello,\n\nStatus update for Load #${load.reference_number}:\n${where}\n`
        + `ETA: ${etaLabel ?? '[ETA]'}\n\nThank you,\n${company}`.trimEnd(),
      );
    } finally {
      setPreparing(false);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('broker-email', {
        body: { action: 'broker_update', load_id: load.id, text: text.trim() },
      });
      if (data?.error) throw new Error(data.error);
      if (error) {
        const detail = await (error as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      setSent(true);
      setSentNow(new Date().toISOString());
      toast.success(`Actualización enviada a ${data?.to ?? 'el broker'}`);
      onSent?.();
      setTimeout(() => setOpen(false), 900);
    } catch (e: any) {
      toast.error('No se envió', { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) prepare(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-7 px-3 inline-flex items-center gap-1 rounded-full text-[11px] font-medium bg-[#0b57d0] hover:bg-[#0842a0] text-white transition-colors whitespace-nowrap"
          title={lastAt ? `Última actualización al broker ${ago(lastAt)}` : 'Enviar ubicación y ETA al broker (hilo de Gmail)'}
        >
          <Mail className="h-3 w-3" /> Broker{lastAt ? ` · ${ago(lastAt).replace('hace ', '')}` : ''}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-[#1f1f1f] dark:text-foreground">Actualización al broker · #{load.reference_number}</p>
        <p className="mt-0.5 text-[11px] text-[#444746] dark:text-muted-foreground">
          Se responde en el hilo de Gmail de la carga{lastAt ? ` · última ${ago(lastAt)}` : ''}
        </p>
        {preparing ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-3 text-xs rounded-xl" />
        )}
        <button
          type="button"
          onClick={send}
          disabled={preparing || sending || sent || !text.trim()}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0b57d0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {sent ? 'Enviado' : 'Enviar al broker'}
        </button>
      </PopoverContent>
    </Popover>
  );
};

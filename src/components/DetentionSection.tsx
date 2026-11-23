import { useCallback, useEffect, useMemo, useState } from 'react';
import { Timer, Pencil, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DetentionStop, DETENTION_FREE_MIN, fmtDuration, loadDetention } from '@/lib/detention';
import { appointmentStart, stopTimeZone } from '@/lib/stopEta';

interface LoadInfo {
  id: string;
  reference_number: string;
  company_id?: string | null;
}

const shortPlace = (addr: string) => {
  const parts = (addr || '').split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 1; i--) {
    const m = parts[i].match(/\b([A-Z]{2})\b/);
    if (m) return `${parts[i - 1] || parts[0]}, ${m[1]}`;
  }
  return parts.slice(0, 2).join(', ');
};

/** Hora en la zona de la parada: "11/23 7:45 AM CT" */
const fmtAt = (d: Date | string, address: string) =>
  new Date(d).toLocaleString('en-US', { timeZone: stopTimeZone(address), month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

/** ISO → valor de <input type="datetime-local"> en la hora de esta computadora */
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

async function callBroker(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('broker-email', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}

/** Detention de la carga: espera en cada parada (llegada → salida), monto y reclamo al broker */
export function DetentionSection({ load }: { load: LoadInfo }) {
  const [stops, setStops] = useState<DetentionStop[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [claimedAt, setClaimedAt] = useState<string | null>(null);
  const [claimNote, setClaimNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, { arrived: string; departed: string }>>({});
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const fetchData = useCallback(async () => {
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from('load_stops').select('id, stop_type, stop_order, address, date, time, arrived_at, departed_at, has_detention' as any)
        .eq('load_id', load.id).order('stop_order'),
      supabase.from('loads').select('detention_rate, detention_claimed_at, detention_claim_note' as any).eq('id', load.id).maybeSingle(),
    ]);
    setStops(((s as any[]) || []) as DetentionStop[]);
    setRate((l as any)?.detention_rate ?? null);
    setClaimedAt((l as any)?.detention_claimed_at ?? null);
    setClaimNote((l as any)?.detention_claim_note ?? null);
  }, [load.id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Mientras alguien esté en una parada, el contador avanza solo
  const anyOpen = stops.some(s => s.arrived_at && !s.departed_at);
  useEffect(() => {
    if (!anyOpen) return;
    const t = setInterval(() => tick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, [anyOpen]);

  const det = useMemo(() => loadDetention(stops, rate), [stops, rate]);

  // Parada con tiempo cobrable → se prende sola la marca de detention (etiqueta 5DETENTION en el
  // hilo de Gmail y badge en Loads). Nunca se apaga sola: quitarla sigue siendo manual.
  useEffect(() => {
    const toMark = det.perStop
      .filter(({ stop, d }) => d && !d.open && !d.lateArrival && d.billableMin > 0 && !(stop as any).has_detention)
      .map(({ stop }) => stop.id);
    if (toMark.length === 0) return;
    supabase.from('load_stops').update({ has_detention: true } as any).in('id', toMark)
      .then(({ error }) => { if (!error) setStops(prev => prev.map(s => toMark.includes(s.id) ? { ...s, has_detention: true } as any : s)); });
  }, [det]);
  const hasArrivals = stops.some(s => s.arrived_at);

  const startEdit = () => {
    setDraft(Object.fromEntries(stops.map(s => [s.id, { arrived: toLocalInput(s.arrived_at), departed: toLocalInput(s.departed_at) }])));
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      for (const s of stops) {
        const d = draft[s.id];
        if (!d) continue;
        const arrived = d.arrived ? new Date(d.arrived).toISOString() : null;
        const departed = d.departed ? new Date(d.departed).toISOString() : null;
        if (arrived && departed && departed < arrived) throw new Error('La salida no puede ser antes de la llegada');
        const changed = (arrived ?? null) !== (s.arrived_at ? new Date(s.arrived_at).toISOString() : null)
          || (departed ?? null) !== (s.departed_at ? new Date(s.departed_at).toISOString() : null);
        if (!changed) continue;
        const { error } = await supabase.from('load_stops').update({ arrived_at: arrived, departed_at: departed } as any).eq('id', s.id);
        if (error) throw error;
      }
      await supabase.from('loads').update({ detention_rate: rate } as any).eq('id', load.id);
      setEditing(false);
      await fetchData();
      toast.success('Horas guardadas');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openClaim = async () => {
    let company = '';
    if (load.company_id) {
      const { data } = await supabase.from('companies').select('name').eq('id', load.company_id).maybeSingle();
      company = (data as any)?.name ?? '';
    }
    const lines = det.perStop
      .filter(({ d }) => d && !d.open && !d.lateArrival && d.billableMin > 0)
      .map(({ stop, d }) => {
        const appt = appointmentStart(stop.date, stop.time, stopTimeZone(stop.address));
        return `- ${stop.stop_type === 'pickup' ? 'Pickup' : 'Delivery'} ${shortPlace(stop.address)}: `
          + `${appt ? `appointment ${fmtAt(appt, stop.address)}, ` : ''}arrived ${fmtAt(stop.arrived_at!, stop.address)}, `
          + `departed ${fmtAt(stop.departed_at!, stop.address)} → ${fmtDuration(d!.waitedMin)} on site, ${fmtDuration(d!.billableMin)} billable`;
      });
    setClaimText(
      `Hello,\n\nWe are requesting detention for Load #${load.reference_number}. `
      + `Our driver waited more than the ${DETENTION_FREE_MIN / 60} free hours:\n\n${lines.join('\n')}\n\n`
      + `Total billable: ${fmtDuration(det.billableMin)} x $${det.rate}/hr = $${det.amount.toFixed(2)}\n\n`
      + `Please add the detention to the rate confirmation. Arrival and departure times are recorded by our driver app GPS.\n\n`
      + `Thank you,\n${company}`.trimEnd(),
    );
    setClaimOpen(true);
  };

  const sendClaim = async () => {
    setBusy(true);
    try {
      const r = await callBroker({ action: 'detention_claim', load_id: load.id, text: claimText, amount: det.amount, minutes: det.billableMin });
      toast.success(`Reclamo enviado a ${r.to}`);
      setClaimOpen(false);
      await fetchData();
    } catch (e: any) {
      toast.error(`No se envió: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!hasArrivals && !editing) return null;

  return (
    <div className="w-full min-w-0 overflow-hidden px-4 py-3 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> Detention
        </h5>
        {claimedAt ? (
          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Reclamado</span>
        ) : det.billableMin > 0 ? (
          <span className="text-xs font-medium text-[#b3261e]">{fmtDuration(det.billableMin)} · ${det.amount.toFixed(2)}</span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        {stops.map(s => {
          const d = det.perStop.find(p => p.stop.id === s.id)?.d;
          if (editing) {
            const v = draft[s.id] ?? { arrived: '', departed: '' };
            return (
              <div key={s.id} className="rounded-2xl bg-[#f8fafd] dark:bg-muted/30 px-3 py-2 space-y-1.5">
                <p className="text-xs font-medium truncate">{s.stop_type === 'pickup' ? 'Pickup' : 'Delivery'} · {shortPlace(s.address)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-[#444746]">Llegada
                    <Input type="datetime-local" className="h-8 text-xs" value={v.arrived} onChange={e => setDraft(p => ({ ...p, [s.id]: { ...v, arrived: e.target.value } }))} />
                  </label>
                  <label className="text-[11px] text-[#444746]">Salida
                    <Input type="datetime-local" className="h-8 text-xs" value={v.departed} onChange={e => setDraft(p => ({ ...p, [s.id]: { ...v, departed: e.target.value } }))} />
                  </label>
                </div>
              </div>
            );
          }
          if (!s.arrived_at) {
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{s.stop_type === 'pickup' ? 'Pickup' : 'Delivery'} · {shortPlace(s.address)}</span>
                <span>Sin llegada</span>
              </div>
            );
          }
          const warn = d && d.open && d.waitedMin >= 90;
          return (
            <div key={s.id} className="rounded-2xl bg-[#f8fafd] dark:bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{s.stop_type === 'pickup' ? 'Pickup' : 'Delivery'} · {shortPlace(s.address)}</span>
                {d && (
                  <span className={`text-xs font-medium whitespace-nowrap ${d.billableMin > 0 && !d.lateArrival ? 'text-[#b3261e]' : warn ? 'text-[#b06000]' : 'text-[#444746]'}`}>
                    {d.open ? 'En la parada ' : ''}{fmtDuration(d.waitedMin)}
                    {d.billableMin > 0 && !d.lateArrival ? ` · ${fmtDuration(d.billableMin)} cobrable` : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Llegó {fmtAt(s.arrived_at, s.address)} · {s.departed_at ? `Salió ${fmtAt(s.departed_at, s.address)}` : 'sin salida aún'}
              </p>
              {d?.lateArrival && <p className="text-[11px] text-[#b06000] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Llegó después de la cita: normalmente no se paga detention</p>}
              {warn && d?.billableMin === 0 && <p className="text-[11px] text-[#b06000]">Avísale al broker antes de cumplir las 2 h.</p>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-[#444746]">
          $/hora
          <Input
            type="number" min={0} className="h-8 w-20 text-xs"
            value={rate ?? ''} placeholder={String(det.rate)}
            onChange={e => setRate(e.target.value === '' ? null : Number(e.target.value))}
            onBlur={() => { if (!editing) void supabase.from('loads').update({ detention_rate: rate } as any).eq('id', load.id); }}
          />
        </label>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button>
              <Button size="sm" className="rounded-full" onClick={saveEdit} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="rounded-full text-[#0b57d0]" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Editar horas</Button>
              {det.billableMin > 0 && (
                <Button size="sm" className="rounded-full" onClick={openClaim}>
                  <Send className="h-3.5 w-3.5" /> {claimedAt ? 'Reenviar reclamo' : 'Reclamar al broker'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {claimedAt && claimNote && <p className="text-[11px] text-muted-foreground">{claimNote}</p>}

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-w-xl w-[calc(100vw-32px)] rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background">
          <DialogHeader>
            <DialogTitle className="text-[22px] leading-7 font-normal">Reclamo de detention · #{load.reference_number}</DialogTitle>
            <DialogDescription>Se responde en el hilo de Gmail del broker de esta carga. Revisa el texto antes de enviar.</DialogDescription>
          </DialogHeader>
          <Textarea className="min-h-[260px] text-sm bg-white dark:bg-card rounded-lg" value={claimText} onChange={e => setClaimText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setClaimOpen(false)} disabled={busy}>Cancelar</Button>
            <Button className="rounded-full" onClick={sendClaim} disabled={busy || !claimText.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar al broker
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

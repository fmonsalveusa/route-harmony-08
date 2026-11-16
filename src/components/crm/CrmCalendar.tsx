import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronLeft, ChevronRight, Bell, CalendarCheck, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const TZ = 'America/New_York';
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export interface CalendarContact {
  id: string;
  name: string;
  phone: string | null;
  phone_key: string | null;
  stage: string;
  next_action: string | null;
  next_action_at: string | null;
  next_action_type: 'reminder' | 'client_message' | null;
  reminder_sent_at: string | null;
}

type Kind = 'meeting' | 'reminder' | 'client_message';
interface Item {
  key: string;
  kind: Kind;
  minutes: number;
  time: string;
  title: string;
  detail?: string;
  contactId?: string;
  overdue: boolean;
  done: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const etDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const etTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const etMinutes = (iso: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  return h * 60 + m;
};
/** "4:30 PM" → minutos del día */
const labelMinutes = (t: string) => {
  const m = String(t ?? '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  return m ? ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]) : 0;
};

const KIND_STYLE: Record<Kind, { icon: typeof Bell; cls: string; label: string }> = {
  meeting: { icon: CalendarCheck, cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', label: 'Reunión' },
  reminder: { icon: Bell, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', label: 'Seguimiento' },
  client_message: { icon: Send, cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', label: 'Mensaje al cliente' },
};

const DOT: Record<string, string> = {
  meeting: 'bg-violet-500', reminder: 'bg-amber-500', client_message: 'bg-sky-500', overdue: 'bg-red-500',
};

/** Calendario compacto del CRM (al lado del tablero): reuniones, seguimientos y mensajes programados del mes */
export function CrmCalendar({ contacts, onOpen }: { contacts: CalendarContact[]; onOpen: (contactId: string) => void }) {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [ty, tm] = todayKey.split('-').map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm - 1 });
  const [selected, setSelected] = useState(todayKey);

  const first = dayKey(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const last = dayKey(month.y, month.m, daysInMonth);

  const { data: meetings = [] } = useQuery({
    queryKey: ['crm_calendar_meetings', first],
    queryFn: async () => {
      const { data } = await supabase.from('meeting_requests' as any)
        .select('id, driver_name, phone, meeting_date, meeting_time, truck_type, status')
        .gte('meeting_date', first).lte('meeting_date', last).neq('status', 'cancelled');
      return (data as any[]) ?? [];
    },
  });

  const byDay = useMemo(() => {
    const map: Record<string, Item[]> = {};
    const add = (d: string, it: Item) => { (map[d] ??= []).push(it); };
    const byPhone = new Map(contacts.filter(c => c.phone_key).map(c => [c.phone_key!, c.id]));
    const now = Date.now();

    for (const m of meetings) {
      const key = String(m.phone ?? '').replace(/\D/g, '').slice(-10);
      add(m.meeting_date, {
        key: `m-${m.id}`, kind: 'meeting', minutes: labelMinutes(m.meeting_time), time: m.meeting_time,
        title: m.driver_name, detail: m.truck_type ?? undefined, contactId: byPhone.get(key),
        overdue: false, done: m.meeting_date < todayKey,
      });
    }
    for (const c of contacts) {
      if (!c.next_action_at || c.stage === 'client') continue;
      const d = etDay(c.next_action_at);
      if (d < first || d > last) continue;
      const kind: Kind = c.next_action_type === 'client_message' ? 'client_message' : 'reminder';
      const done = kind === 'client_message' && !!c.reminder_sent_at;
      add(d, {
        key: `c-${c.id}`, kind, minutes: etMinutes(c.next_action_at), time: etTime(c.next_action_at),
        title: c.name || c.phone || '—', detail: c.next_action ?? undefined, contactId: c.id,
        overdue: !done && new Date(c.next_action_at).getTime() <= now, done,
      });
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.minutes - b.minutes);
    return map;
  }, [meetings, contacts, first, last, todayKey]);

  const lead = new Date(month.y, month.m, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('es-US', { month: 'long', year: 'numeric' });
  const shift = (n: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const dayItems = byDay[selected] ?? [];
  const selectedLabel = (() => {
    const [y, m, d] = selected.split('-').map(Number);
    const txt = new Date(y, m - 1, d).toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'short' });
    return selected === todayKey ? `Hoy · ${txt}` : txt;
  })();

  return (
    <div className="rounded-xl border bg-card flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b">
        <CalendarDays className="h-4 w-4 text-primary shrink-0" />
        <span className="text-base font-semibold capitalize flex-1 truncate">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => { setMonth({ y: ty, m: tm - 1 }); setSelected(todayKey); }}>Hoy</Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-7 mb-0.5">
          {WEEKDAYS.map(d => <div key={d} className="text-[11px] font-medium text-muted-foreground text-center">{d.charAt(0)}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} className="h-11" />;
            const key = dayKey(month.y, month.m, d);
            const items = byDay[key] ?? [];
            const kinds = [...new Set(items.map(it => (it.overdue ? 'overdue' : it.kind)))];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  'h-11 rounded-md flex flex-col items-center justify-center text-xs transition-colors',
                  key === selected ? 'bg-primary text-primary-foreground' : key === todayKey ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted',
                  key < todayKey && key !== selected && 'text-muted-foreground',
                )}
              >
                {d}
                <span className="flex gap-0.5 h-1.5 mt-0.5">
                  {kinds.slice(0, 3).map(k => <span key={k} className={cn('h-1.5 w-1.5 rounded-full', DOT[k])} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t px-2 py-1.5 flex-1 min-h-0 flex flex-col">
        <p className="text-[11px] font-semibold text-muted-foreground capitalize mb-1">{selectedLabel}</p>
        <div className="space-y-1 overflow-y-auto">
          {dayItems.length === 0 && <p className="text-xs text-muted-foreground py-2">Nada agendado.</p>}
          {dayItems.map(it => {
            const st = KIND_STYLE[it.kind];
            return (
              <button
                key={it.key}
                type="button"
                disabled={!it.contactId}
                onClick={() => it.contactId && onOpen(it.contactId)}
                title={it.detail ?? ''}
                className={cn(
                  'w-full text-left rounded-md px-1.5 py-1 text-xs flex items-start gap-1.5',
                  it.overdue ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : st.cls,
                  it.done && 'line-through opacity-60',
                  it.contactId && 'hover:ring-1 hover:ring-current',
                )}
              >
                <st.icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="font-semibold">{it.time}</span> · <span className="font-medium">{it.title}</span>
                  <span className="block text-[10.5px] opacity-80 truncate">{it.overdue ? 'Vencido · ' : ''}{st.label}{it.detail ? ` — ${it.detail}` : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

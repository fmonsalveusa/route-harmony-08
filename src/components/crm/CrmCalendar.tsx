import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Bell, CalendarCheck, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const TZ = 'America/New_York';
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const STORAGE_KEY = 'crm-calendar-open';

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

/** Calendario del mes en el CRM: reuniones agendadas, seguimientos y mensajes programados */
export function CrmCalendar({ contacts, onOpen }: { contacts: CalendarContact[]; onOpen: (contactId: string) => void }) {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [ty, tm] = todayKey.split('-').map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm - 1 });
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
  });
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(STORAGE_KEY, o ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return !o;
  });

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
  const total = Object.values(byDay).reduce((n, l) => n + l.length, 0);
  const shift = (n: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <button type="button" onClick={toggle} className="flex items-center gap-2 text-sm font-semibold">
          <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          <CalendarDays className="h-4 w-4 text-primary" /> Calendario
          <span className="text-xs font-normal text-muted-foreground">({total} {total === 1 ? 'pendiente' : 'pendientes'} en el mes)</span>
        </button>
        {open && (
          <div className="ml-auto flex items-center gap-1">
            {(month.y !== ty || month.m !== tm - 1) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonth({ y: ty, m: tm - 1 })}>Hoy</Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium capitalize w-36 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {open && (
        <div className="p-2 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => <div key={d} className="text-[11px] font-medium text-muted-foreground text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} className="min-h-[92px] rounded-md bg-muted/20" />;
                const key = dayKey(month.y, month.m, d);
                const items = byDay[key] ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={key} className={cn('min-h-[92px] rounded-md border p-1 flex flex-col', isToday ? 'border-primary bg-primary/5' : 'bg-background', key < todayKey && 'opacity-70')}>
                    <span className={cn('text-[11px] font-semibold mb-0.5', isToday ? 'text-primary' : 'text-muted-foreground')}>{d}</span>
                    <div className="space-y-0.5 overflow-y-auto max-h-[110px]">
                      {items.map(it => {
                        const st = KIND_STYLE[it.kind];
                        return (
                          <button
                            key={it.key}
                            type="button"
                            disabled={!it.contactId}
                            onClick={() => it.contactId && onOpen(it.contactId)}
                            title={`${st.label} · ${it.time} · ${it.title}${it.detail ? ` — ${it.detail}` : ''}`}
                            className={cn(
                              'w-full text-left rounded px-1 py-0.5 text-[10.5px] leading-tight flex items-center gap-1 truncate',
                              it.overdue ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : st.cls,
                              it.done && 'line-through opacity-60',
                              it.contactId && 'hover:ring-1 hover:ring-current',
                            )}
                          >
                            <st.icon className="h-3 w-3 shrink-0" />
                            <span className="font-semibold shrink-0">{it.time.replace(':00', '').replace(' ', '')}</span>
                            <span className="truncate">{it.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 px-1 text-[11px] text-muted-foreground">
              {(Object.keys(KIND_STYLE) as Kind[]).map(k => {
                const st = KIND_STYLE[k];
                return <span key={k} className="flex items-center gap-1"><span className={cn('h-2.5 w-2.5 rounded-sm', st.cls)} />{st.label}</span>;
              })}
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-100 dark:bg-red-900/40" />Vencido</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

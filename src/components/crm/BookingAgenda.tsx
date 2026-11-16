import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CalendarDays, CheckCircle2, Copy, ExternalLink, Link2, Loader2, Mail, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BOOKING_URL = 'https://www.dispatch-up.com/agendar';
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface Settings {
  tenant_id: string;
  weekdays: number[];
  day_start: string;
  day_end: string;
  duration_min: number;
  buffer_min: number;
  min_notice_hours: number;
  max_days_ahead: number;
  calendar_email: string | null;
  meeting_title: string;
}

interface Meeting {
  id: string;
  driver_name: string;
  phone: string;
  email: string | null;
  truck_type: string | null;
  service_interest: string | null;
  meeting_date: string;
  meeting_time: string;
  status: string | null;
  manage_token: string;
}

const todayEt = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

function prettyDay(d: string) {
  const [y, m, da] = d.split('-').map(Number);
  const date = new Date(y, m - 1, da);
  const label = date.toLocaleDateString('es-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return d === todayEt() ? `Hoy · ${label}` : label;
}

/** "4:30 PM" → minutos, para ordenar las del mismo día */
function minutes(t: string) {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
}

function Upcoming() {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['booking_upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_requests' as any)
        .select('id, driver_name, phone, email, truck_type, service_interest, meeting_date, meeting_time, status, manage_token')
        .gte('meeting_date', todayEt()).neq('status', 'cancelled').order('meeting_date');
      if (error) throw error;
      return ((data as any[]) ?? []).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || minutes(a.meeting_time) - minutes(b.meeting_time)) as Meeting[];
    },
  });

  const cancel = async (m: Meeting) => {
    if (!window.confirm(`¿Cancelar la llamada con ${m.driver_name}? ${m.email ? 'Se le avisa por email.' : ''}`)) return;
    setCancelling(m.id);
    const { data, error } = await supabase.functions.invoke('booking', { body: { action: 'cancel', token: m.manage_token } });
    setCancelling(null);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    toast.success('Llamada cancelada');
    qc.invalidateQueries({ queryKey: ['booking_upcoming'] });
    qc.invalidateQueries({ queryKey: ['crm_meetings'] });
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#444746]" /></div>;
  if (!meetings.length) return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="h-14 w-14 rounded-full bg-[#f0f4f9] dark:bg-muted flex items-center justify-center mb-3">
        <CalendarDays className="h-7 w-7 text-[#0b57d0] dark:text-blue-300" />
      </span>
      <p className="text-sm text-[#444746] dark:text-muted-foreground">No hay llamadas agendadas.</p>
    </div>
  );

  const byDay = meetings.reduce<Record<string, Meeting[]>>((acc, m) => { (acc[m.meeting_date] ??= []).push(m); return acc; }, {});
  return (
    <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day}>
          <p className="text-sm font-medium text-[#0b57d0] dark:text-blue-300 mb-2 px-1">{cap(prettyDay(day))}</p>
          <div className="space-y-2">
            {list.map(m => (
              <div key={m.id} className="rounded-2xl bg-[#f0f4f9] dark:bg-muted/60 px-4 py-3 flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-medium text-[#1f1f1f] dark:text-foreground">{m.meeting_time}</p>
                  <p className="text-[11px] text-[#444746] dark:text-muted-foreground">ET</p>
                </div>
                <span className="w-1 self-stretch rounded-full bg-[#0b57d0]" />
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-medium text-[#1f1f1f] dark:text-foreground truncate">{m.driver_name}</p>
                  <p className="text-[#444746] dark:text-muted-foreground text-xs flex flex-wrap gap-x-3">
                    <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-[#0b57d0]"><Phone className="h-3 w-3" />{m.phone}</a>
                    {m.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{m.email}</span>}
                  </p>
                  {(m.truck_type || m.service_interest) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[m.truck_type, m.service_interest].filter(Boolean).map(t => (
                        <span key={t} className="rounded-md bg-white dark:bg-card px-1.5 py-0.5 text-[10.5px] font-medium text-[#444746] dark:text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs font-medium text-[#b3261e] hover:bg-[#fce8e6] hover:text-[#b3261e]" disabled={cancelling === m.id} onClick={() => cancel(m)}>
                  {cancelling === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Cancelar
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const G_LABEL = 'text-xs font-medium text-[#444746] dark:text-muted-foreground';
const G_INPUT = 'h-10 text-sm rounded-lg shadow-none border-[#c4c7c5] dark:border-border focus-visible:ring-1 focus-visible:ring-[#0b57d0] focus-visible:border-[#0b57d0]';
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Availability() {
  const { role, isMasterAdmin } = useAuth();
  const canEdit = role === 'admin' || isMasterAdmin;
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [calendar, setCalendar] = useState<'ok' | 'error' | 'off' | null>(null);

  useEffect(() => {
    supabase.functions.invoke('booking', { body: { action: 'availability' } }).then(({ data }) => setCalendar(data?.calendar ?? null));
    supabase.from('booking_settings' as any).select('*').limit(1).maybeSingle()
      .then(({ data }) => setS(data ? { ...(data as any), day_start: (data as any).day_start.slice(0, 5), day_end: (data as any).day_end.slice(0, 5) } : null));
  }, []);

  if (!s) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#444746]" /></div>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(prev => (prev ? { ...prev, [k]: v } : prev));
  const save = async () => {
    if (s.day_end <= s.day_start) { toast.error('La hora final debe ser después de la inicial'); return; }
    setSaving(true);
    const { tenant_id, ...rest } = s;
    const { error } = await supabase.from('booking_settings' as any)
      .update({ ...rest, calendar_email: rest.calendar_email?.trim() || null, updated_at: new Date().toISOString() } as any)
      .eq('tenant_id', tenant_id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success('Disponibilidad guardada');
  };

  const num = (k: 'duration_min' | 'buffer_min' | 'min_notice_hours' | 'max_days_ahead', label: string, suffix: string) => (
    <div className="space-y-1">
      <Label className={G_LABEL}>{label}</Label>
      <div className="relative">
        <Input type="number" min={0} value={s[k]} disabled={!canEdit} onChange={e => set(k, Math.max(0, Number(e.target.value) || 0))} className={cn(G_INPUT, 'pr-20')} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#444746] dark:text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      <div className="rounded-3xl border border-[#e3e3e3] dark:border-border p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className={G_LABEL}>Días disponibles</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = s.weekdays.includes(i);
              return (
                <button key={d} type="button" disabled={!canEdit}
                  onClick={() => set('weekdays', on ? s.weekdays.filter(x => x !== i) : [...s.weekdays, i].sort())}
                  className={cn('h-10 w-10 rounded-full text-xs font-medium transition-colors',
                    on ? 'bg-[#0b57d0] text-white' : 'border border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground hover:bg-[#f0f4f9] dark:hover:bg-muted')}>
                  {d.slice(0, 2)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className={G_LABEL}>Desde (hora del Este)</Label>
            <Input type="time" value={s.day_start} disabled={!canEdit} onChange={e => set('day_start', e.target.value)} className={G_INPUT} />
          </div>
          <div className="space-y-1">
            <Label className={G_LABEL}>Hasta (hora del Este)</Label>
            <Input type="time" value={s.day_end} disabled={!canEdit} onChange={e => set('day_end', e.target.value)} className={G_INPUT} />
          </div>
          {num('duration_min', 'Duración de la llamada', 'min')}
          {num('buffer_min', 'Tiempo entre llamadas', 'min')}
          {num('min_notice_hours', 'Aviso mínimo', 'horas antes')}
          {num('max_days_ahead', 'Se puede agendar hasta', 'días')}
        </div>
      </div>

      <div className="rounded-3xl border border-[#e3e3e3] dark:border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className={G_LABEL}>Tu Google Calendar (email que recibe cada aviso)</Label>
          <Input type="email" placeholder="tu-cuenta@gmail.com" value={s.calendar_email ?? ''} disabled={!canEdit} onChange={e => set('calendar_email', e.target.value)} className={G_INPUT} />
        </div>
        {calendar && (
          <div className={cn('flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium',
            calendar === 'ok' ? 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200'
              : calendar === 'error' ? 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200'
              : 'bg-[#f0f4f9] text-[#444746] dark:bg-muted dark:text-muted-foreground')}>
            {calendar === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {calendar === 'ok' ? 'Google Calendar conectado: tus horas ocupadas se bloquean solas'
              : calendar === 'error' ? 'No se pudo leer Google Calendar (revisa la dirección secreta iCal)'
              : 'Google Calendar sin conectar (falta la dirección secreta iCal)'}
          </div>
        )}
        <div className="space-y-1">
          <Label className={G_LABEL}>Nombre del evento</Label>
          <Input value={s.meeting_title} disabled={!canEdit} onChange={e => set('meeting_title', e.target.value)} className={G_INPUT} />
        </div>
      </div>

      {canEdit ? (
        <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 bg-white dark:bg-background flex justify-end">
          <Button onClick={save} disabled={saving} className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Guardar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[#444746] dark:text-muted-foreground">Solo un admin puede cambiar la disponibilidad.</p>
      )}
    </div>
  );
}

/** Botón "Agenda" del CRM: próximas llamadas, disponibilidad y el enlace público para agendar */
export function BookingAgenda() {
  const [open, setOpen] = useState(false);
  const copy = () => { navigator.clipboard.writeText(BOOKING_URL); toast.success('Enlace copiado'); };
  return (
    <>
      <Button variant="outline" className="h-12 rounded-2xl px-5 gap-2 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => setOpen(true)}><CalendarDays className="h-5 w-5" /> Agenda</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-0 p-0 gap-0 overflow-hidden bg-white dark:bg-background">
          <DialogHeader className="px-6 pt-6 pb-3 space-y-0">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Agenda de llamadas</DialogTitle>
                <p className="text-sm text-[#444746] dark:text-muted-foreground">Reuniones que agendan desde tu enlace</p>
              </div>
            </div>
          </DialogHeader>
          <div className="mx-6 flex items-center gap-1 rounded-full bg-[#f0f4f9] dark:bg-muted pl-4 pr-1 h-11 text-sm">
            <Link2 className="h-4 w-4 text-[#444746] dark:text-muted-foreground shrink-0" />
            <span className="truncate flex-1 text-[#1f1f1f] dark:text-foreground ml-1">{BOOKING_URL.replace('https://', '')}</span>
            <Button variant="ghost" size="sm" className="h-9 rounded-full px-3 gap-1.5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] font-medium" onClick={copy}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#444746] hover:bg-black/5" asChild><a href={BOOKING_URL} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink className="h-4 w-4" /></a></Button>
          </div>
          <Tabs defaultValue="upcoming" className="mt-3">
            <TabsList className="w-full justify-start rounded-none border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-4">
              {[['upcoming', 'Próximas llamadas'], ['availability', 'Disponibilidad']].map(([v, l]) => (
                <TabsTrigger key={v} value={v}
                  className="h-12 rounded-none border-b-[3px] border-transparent px-4 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="upcoming" className="p-6 pt-4 mt-0"><Upcoming /></TabsContent>
            <TabsContent value="availability" className="p-6 pt-4 mt-0"><Availability /></TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

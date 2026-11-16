import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Copy, ExternalLink, Loader2, Mail, Phone, X } from 'lucide-react';
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

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!meetings.length) return <p className="text-sm text-muted-foreground py-8 text-center">No hay llamadas agendadas.</p>;

  const byDay = meetings.reduce<Record<string, Meeting[]>>((acc, m) => { (acc[m.meeting_date] ??= []).push(m); return acc; }, {});
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day}>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 capitalize">{prettyDay(day)}</p>
          <div className="space-y-2">
            {list.map(m => (
              <div key={m.id} className="rounded-lg border p-3 flex items-start gap-3">
                <div className="text-sm font-bold w-20 shrink-0">{m.meeting_time}</div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold truncate">{m.driver_name}</p>
                  <p className="text-muted-foreground text-xs flex flex-wrap gap-x-3">
                    <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{m.phone}</a>
                    {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                  </p>
                  {(m.truck_type || m.service_interest) && (
                    <p className="text-xs text-muted-foreground">{[m.truck_type, m.service_interest].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" disabled={cancelling === m.id} onClick={() => cancel(m)}>
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

  if (!s) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>;

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
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} value={s[k]} disabled={!canEdit} onChange={e => set(k, Math.max(0, Number(e.target.value) || 0))} className="h-9" />
        <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Días disponibles</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {WEEKDAYS.map((d, i) => {
            const on = s.weekdays.includes(i);
            return (
              <button key={d} type="button" disabled={!canEdit}
                onClick={() => set('weekdays', on ? s.weekdays.filter(x => x !== i) : [...s.weekdays, i].sort())}
                className={cn('h-8 w-12 rounded-md border text-xs font-medium', on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground')}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Desde (hora del Este)</Label>
          <Input type="time" value={s.day_start} disabled={!canEdit} onChange={e => set('day_start', e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Hasta (hora del Este)</Label>
          <Input type="time" value={s.day_end} disabled={!canEdit} onChange={e => set('day_end', e.target.value)} className="h-9" />
        </div>
        {num('duration_min', 'Duración de la llamada', 'min')}
        {num('buffer_min', 'Tiempo entre llamadas', 'min')}
        {num('min_notice_hours', 'Aviso mínimo', 'horas antes')}
        {num('max_days_ahead', 'Se puede agendar hasta', 'días')}
      </div>
      <div>
        <Label className="text-xs">Tu Google Calendar (email que recibe cada invitación)</Label>
        <Input type="email" placeholder="tu-cuenta@gmail.com" value={s.calendar_email ?? ''} disabled={!canEdit} onChange={e => set('calendar_email', e.target.value)} className="h-9" />
        <p className="text-[11px] text-muted-foreground mt-1">Las horas ocupadas de ese calendario se bloquean solas en la agenda.</p>
        {calendar && (
          <p className={cn('text-[11px] mt-1 font-medium', calendar === 'ok' ? 'text-green-600' : calendar === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {calendar === 'ok' ? '● Google Calendar conectado: tus horas ocupadas se están bloqueando'
              : calendar === 'error' ? '● No se pudo leer Google Calendar (revisa la dirección secreta iCal)'
              : '○ Google Calendar sin conectar (falta la dirección secreta iCal)'}
          </p>
        )}
      </div>
      <div>
        <Label className="text-xs">Nombre del evento</Label>
        <Input value={s.meeting_title} disabled={!canEdit} onChange={e => set('meeting_title', e.target.value)} className="h-9" />
      </div>
      {canEdit ? (
        <Button onClick={save} disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Guardar disponibilidad</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Solo un admin puede cambiar la disponibilidad.</p>
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
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><CalendarDays className="h-4 w-4" /> Agenda</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Agenda de llamadas</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="truncate flex-1 font-medium">{BOOKING_URL}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild><a href={BOOKING_URL} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
          </div>
          <Tabs defaultValue="upcoming">
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">Próximas llamadas</TabsTrigger>
              <TabsTrigger value="availability" className="flex-1">Disponibilidad</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="pt-2"><Upcoming /></TabsContent>
            <TabsContent value="availability" className="pt-2"><Availability /></TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

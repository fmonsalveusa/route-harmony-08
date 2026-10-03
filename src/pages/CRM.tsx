import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Contact, Plus, Search, Phone, MessageCircle, Globe, UserCheck, PenLine, CalendarClock, AlertCircle,
  Users as UsersIcon, CalendarCheck, Trophy, Bell, Trash2, Loader2, Send,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatTiles } from '@/components/StatTiles';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Stage = 'new' | 'contacted' | 'meeting_scheduled' | 'meeting_done' | 'onboarding' | 'client' | 'lost';

interface CrmContact {
  id: string;
  name: string;
  phone: string | null;
  phone_key: string | null;
  email: string | null;
  city: string | null;
  vehicle: string | null;
  service: string | null;
  source: string;
  stage: Stage;
  next_action: string | null;
  next_action_at: string | null;
  reminder_sent_at: string | null;
  has_medical_card: boolean;
  has_active_mc: boolean;
  has_eld: boolean;
  meeting: { checks?: Record<string, boolean>; sent?: Record<string, string> } | null;
  whatsapp_group_id: string | null;
  whatsapp_group_name: string | null;
  created_at: string;
  updated_at: string;
}

interface CrmNote {
  id: string;
  kind: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

const STAGES: { id: Stage; label: string; tint: string }[] = [
  { id: 'new', label: 'Nuevo', tint: 'border-t-slate-400' },
  { id: 'contacted', label: 'Contactado', tint: 'border-t-sky-500' },
  { id: 'meeting_scheduled', label: 'Reunión agendada', tint: 'border-t-violet-500' },
  { id: 'meeting_done', label: 'Reunión hecha', tint: 'border-t-amber-500' },
  { id: 'onboarding', label: 'En onboarding', tint: 'border-t-orange-500' },
  { id: 'client', label: 'Cliente registrado', tint: 'border-t-green-600' },
  { id: 'lost', label: 'Perdido', tint: 'border-t-red-500' },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label])) as Record<Stage, string>;

const SOURCE: Record<string, { label: string; icon: typeof Globe }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  web: { label: 'Web', icon: Globe },
  onboarding: { label: 'Onboarding', icon: UserCheck },
  manual: { label: 'Manual', icon: PenLine },
};

const SERVICES = ['OWNER OPERATOR', 'DISPATCH SERVICE', 'COMPANY DRIVER'];
const VEHICLES = ['BOXTRUCK', 'HOTSHOT'];

const CHECKS = [
  { key: 'has_medical_card', label: 'Medical Card' },
  { key: 'has_active_mc', label: 'MC# Activo' },
  { key: 'has_eld', label: 'Libro electrónico' },
] as const;

/** Pasos de la reunión; los que tienen `send` mandan su texto al grupo del cliente */
const MEETING_STEPS: { id: string; label: string; send?: boolean }[] = [
  { id: 'referido', label: 'Referido' },
  { id: 'service_info', label: 'Información del Servicio', send: true },
  { id: 'own_mc', label: 'MC# Propio' },
  { id: 'our_mc', label: 'MC# Nuestro' },
  { id: 'medical_card', label: 'Medical Card', send: true },
  { id: 'eld', label: 'Libro Electrónico', send: true },
  { id: 'eld_own_mc', label: 'Libro Electrónico MC# Propio', send: true },
];

/** "Juan Perez HS LB": HS = hotshot, 26BT = box truck, LB = referido */
const suggestedGroupName = (name: string, vehicle: string, referred: boolean) =>
  [name.trim(), vehicle === 'HOTSHOT' ? 'HS' : vehicle === 'BOXTRUCK' ? '26BT' : '', referred ? 'LB' : '']
    .filter(Boolean).join(' ');

const invokeGroups = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
};

function MeetingSection({ contact, name, vehicle }: { contact: CrmContact; name: string; vehicle: string }) {
  const qc = useQueryClient();
  const [checks, setChecks] = useState<Record<string, boolean>>(contact.meeting?.checks ?? {});
  const [sent, setSent] = useState<Record<string, string>>(contact.meeting?.sent ?? {});
  const [group, setGroup] = useState({ id: contact.whatsapp_group_id, name: contact.whatsapp_group_name });
  const [groupName, setGroupName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const suggested = suggestedGroupName(name, vehicle, !!checks.referido);
  const subject = nameEdited ? groupName : suggested;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['crm_contacts'] });
    qc.invalidateQueries({ queryKey: ['crm_notes', contact.id] });
  };

  const toggle = async (id: string, value: boolean) => {
    const next = { ...checks, [id]: value };
    setChecks(next);
    const { error } = await supabase.from('crm_contacts' as any)
      .update({ meeting: { checks: next, sent } } as any).eq('id', contact.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ['crm_contacts'] });
  };

  const createGroup = async () => {
    if (!subject.trim()) return;
    if (!window.confirm(`¿Crear el grupo de WhatsApp "${subject}" con ${contact.phone}?`)) return;
    setBusy('group');
    try {
      const r = await invokeGroups({ action: 'crm_create_group', contact_id: contact.id, subject });
      setGroup({ id: r.group_id, name: r.name });
      toast.success('Grupo creado');
      refresh();
    } catch (e: any) {
      toast.error(`No se pudo crear el grupo: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const sendStep = async (id: string, label: string) => {
    if (sent[id] && !window.confirm(`"${label}" ya se envió. ¿Enviarlo de nuevo?`)) return;
    setBusy(id);
    try {
      const r = await invokeGroups({ action: 'crm_send_step', contact_id: contact.id, step: id });
      setSent(s => ({ ...s, [id]: r.sent_at }));
      setChecks(c => ({ ...c, [id]: true }));
      toast.success(`${label} enviado al grupo`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const done = MEETING_STEPS.filter(s => checks[s.id]).length;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide">REUNIÓN</p>
        <span className="text-xs text-muted-foreground">{done}/{MEETING_STEPS.length}</span>
      </div>

      {group.id ? (
        <p className="text-xs flex items-center gap-1.5 text-green-700 dark:text-green-400">
          <MessageCircle className="h-3.5 w-3.5" /> Grupo: {group.name}
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            value={subject}
            onChange={e => { setNameEdited(true); setGroupName(e.target.value); }}
            className="h-8 text-sm"
            placeholder="Nombre del grupo"
          />
          <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={createGroup} disabled={busy !== null || !subject.trim() || !contact.phone}>
            {busy === 'group' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
            Crear grupo de WhatsApp
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {MEETING_STEPS.map(step => (
          <div key={step.id} className="flex items-center gap-2 min-h-8">
            <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
              <Checkbox checked={!!checks[step.id]} onCheckedChange={v => toggle(step.id, v === true)} />
              <span className={cn(checks[step.id] && 'text-muted-foreground line-through')}>{step.label}</span>
            </label>
            {step.send && (
              <>
                {sent[step.id] && <span className="text-[11px] text-muted-foreground">Enviado {fmt(sent[step.id])}</span>}
                <Button
                  size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs"
                  onClick={() => sendStep(step.id, step.label)}
                  disabled={busy !== null || !group.id}
                  title={group.id ? 'Enviar al grupo de WhatsApp' : 'Primero crea el grupo de WhatsApp'}
                >
                  {busy === step.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const NOTE_KINDS: Record<string, string> = {
  note: 'Nota', meeting: 'Reunión', call: 'Llamada', stage: 'Etapa', system: 'Sistema',
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' });

/** datetime-local ↔ ISO, en la hora local del navegador */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const isOverdue = (c: CrmContact) =>
  !!c.next_action_at && new Date(c.next_action_at) <= new Date() && c.stage !== 'client' && c.stage !== 'lost';

const waLink = (phone: string | null) => {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? '1' + d : d}`;
};

function useContacts() {
  return useQuery({
    queryKey: ['crm_contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts' as any).select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmContact[];
    },
  });
}

function ContactCard({ c, onOpen }: { c: CrmContact; onOpen: () => void }) {
  const src = SOURCE[c.source] ?? SOURCE.manual;
  const overdue = isOverdue(c);
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', c.id)}
      onClick={onOpen}
      className={cn(
        'rounded-lg border bg-card p-2.5 shadow-sm cursor-pointer hover:border-primary/50 transition-colors space-y-1',
        overdue && 'border-red-400 bg-red-50 dark:bg-red-950/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight truncate">{c.name || c.phone}</p>
        <src.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-label={src.label} />
      </div>
      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
      {(c.vehicle || c.service) && (
        <p className="text-xs text-muted-foreground truncate">{[c.vehicle, c.service].filter(Boolean).join(' · ')}</p>
      )}
      {c.next_action_at && c.stage !== 'client' && c.stage !== 'lost' && (
        <p className={cn('text-[11px] flex items-center gap-1', overdue ? 'text-red-600 font-medium' : 'text-blue-600')}>
          {overdue ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
          {fmt(c.next_action_at)}{c.next_action ? ` · ${c.next_action}` : ''}
        </p>
      )}
    </div>
  );
}

function ContactDetail({ contact, onClose }: { contact: CrmContact; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: contact.name, phone: contact.phone ?? '', email: contact.email ?? '', city: contact.city ?? '',
    vehicle: contact.vehicle ?? '', service: contact.service ?? '', stage: contact.stage,
    next_action: contact.next_action ?? '', next_action_at: toLocalInput(contact.next_action_at),
    has_medical_card: contact.has_medical_card, has_active_mc: contact.has_active_mc, has_eld: contact.has_eld,
  });
  const [noteKind, setNoteKind] = useState('note');
  const [noteBody, setNoteBody] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['crm_notes', contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_notes' as any).select('*').eq('contact_id', contact.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmNote[];
    },
  });

  const { data: extra } = useQuery({
    queryKey: ['crm_extra', contact.id, contact.phone_key],
    enabled: !!contact.phone_key && contact.phone_key.length === 10,
    queryFn: async () => {
      const key = contact.phone_key!;
      const [{ data: meetings }, { data: leads }] = await Promise.all([
        supabase.from('meeting_requests' as any).select('id, phone, meeting_date, meeting_time, status, comments').order('meeting_date', { ascending: false }),
        supabase.from('whatsapp_leads' as any).select('phone, history'),
      ]);
      const match = (p: string) => (p ?? '').replace(/\D/g, '').slice(-10) === key;
      return {
        meetings: ((meetings as any[]) ?? []).filter(m => match(m.phone)),
        chat: (((leads as any[]) ?? []).find(l => match(l.phone))?.history ?? []) as { role: string; content: string }[],
      };
    },
  });

  const { data: users = {} } = useQuery({
    queryKey: ['crm_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return Object.fromEntries(((data as any[]) ?? []).map(p => [p.id, p.full_name])) as Record<string, string>;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['crm_contacts'] });
    qc.invalidateQueries({ queryKey: ['crm_notes', contact.id] });
  };

  // Guardado automático: cada cambio se guarda solo, y lo pendiente se guarda al cerrar la ficha
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');
  const formRef = useRef(form);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const save = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const form = formRef.current;
    if (!form.name.trim()) { setStatus('error'); toast.error('El nombre no puede quedar vacío'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('crm_contacts' as any).update({
      name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
      city: form.city.trim() || null, vehicle: form.vehicle.trim() || null, service: form.service.trim() || null,
      stage: form.stage, has_medical_card: form.has_medical_card, has_active_mc: form.has_active_mc, has_eld: form.has_eld,
      next_action: form.next_action.trim() || null,
      next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : null,
    } as any).eq('id', contact.id).select('id');
    setSaving(false);
    if (error || !data?.length) {
      setStatus('error');
      toast.error(`No se pudo guardar: ${error?.message ?? 'sin permiso para editar este contacto'}`);
      return;
    }
    setStatus('saved');
    refresh();
  };

  useEffect(() => {
    formRef.current = form;
    if (!dirty.current) return;
    setStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => () => { save(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (changes: Partial<typeof form>) => {
    dirty.current = true;
    setForm(f => ({ ...f, ...changes }));
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = await getTenantId();
    const { error } = await supabase.from('crm_notes' as any).insert({
      tenant_id: tenantId, contact_id: contact.id, kind: noteKind, body: noteBody.trim(), created_by: user?.id ?? null,
    } as any);
    if (error) { toast.error(error.message); return; }
    // Las notas de la reunión pasan el contacto a "Reunión hecha"
    if (noteKind === 'meeting' && ['new', 'contacted', 'meeting_scheduled'].includes(form.stage)) {
      await supabase.from('crm_contacts' as any).update({ stage: 'meeting_done' } as any).eq('id', contact.id);
      setForm(f => ({ ...f, stage: 'meeting_done' }));
    }
    setNoteBody('');
    refresh();
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar a ${contact.name || contact.phone} del CRM? Se borran también sus notas.`)) return;
    dirty.current = false;
    clearTimeout(timer.current);
    const { error } = await supabase.from('crm_contacts' as any).delete().eq('id', contact.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['crm_contacts'] });
    onClose();
  };

  const link = waLink(form.phone);
  const field = (key: 'name' | 'phone' | 'email' | 'city', label: string, type = 'text') => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={form[key]} onChange={e => edit({ [key]: e.target.value })} className="h-8 text-sm" />
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-0">
      <div className="space-y-5 md:pr-6 md:max-h-[72vh] md:overflow-y-auto">
      <div className="flex flex-wrap gap-2">
        {link && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(link, '_blank')}>
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
          </Button>
        )}
        {form.phone && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { window.location.href = `tel:${form.phone}`; }}>
            <Phone className="h-4 w-4" /> Llamar
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive ml-auto" onClick={remove}>
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field('name', 'Nombre')}
        {field('phone', 'Teléfono')}
        {field('email', 'Email')}
        {field('city', 'Ciudad')}
        <div className="space-y-1">
          <Label className="text-xs">Vehículo</Label>
          <Select value={form.vehicle || undefined} onValueChange={v => edit({ vehicle: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {VEHICLES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              {form.vehicle && !VEHICLES.includes(form.vehicle) && <SelectItem value={form.vehicle}>{form.vehicle}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Servicio de interés</Label>
          <Select value={form.service || undefined} onValueChange={v => edit({ service: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {SERVICES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              {form.service && !SERVICES.includes(form.service) && <SelectItem value={form.service}>{form.service}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border p-3">
          {CHECKS.map(ch => (
            <label key={ch.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form[ch.key]} onCheckedChange={v => edit({ [ch.key]: v === true })} />
              {ch.label}
            </label>
          ))}
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Etapa</Label>
          <Select value={form.stage} onValueChange={v => edit({ stage: v as Stage })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
        <p className="text-sm font-medium flex items-center gap-1.5"><Bell className="h-4 w-4" /> Próxima acción</p>
        <Input
          placeholder="Ej: Llamar para enviar el link de onboarding"
          value={form.next_action}
          onChange={e => edit({ next_action: e.target.value })}
          className="h-8 text-sm"
        />
        <div className="flex gap-2 items-center">
          <Input
            type="datetime-local"
            value={form.next_action_at}
            onChange={e => edit({ next_action_at: e.target.value })}
            className="h-8 text-sm"
          />
          {form.next_action_at && (
            <Button size="sm" variant="ghost" className="h-8" onClick={() => edit({ next_action_at: '', next_action: '' })}>Quitar</Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          A esa hora llega un recordatorio al grupo de administración por WhatsApp.
          {contact.reminder_sent_at && contact.next_action_at === (form.next_action_at ? new Date(form.next_action_at).toISOString() : null)
            ? ` Recordatorio enviado ${fmt(contact.reminder_sent_at)}.` : ''}
        </p>
      </div>

      <p className={cn('text-xs text-right', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {saving || status === 'pending' ? 'Guardando…' : status === 'saved' ? '✓ Cambios guardados' : status === 'error' ? 'No se guardó' : 'Los cambios se guardan solos'}
      </p>
      </div>

      <div className="space-y-5 md:pl-6 md:border-l md:max-h-[72vh] md:overflow-y-auto">
      <MeetingSection contact={contact} name={form.name} vehicle={form.vehicle} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Notas y seguimiento</p>
        <div className="flex gap-2">
          <Select value={noteKind} onValueChange={setNoteKind}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Nota</SelectItem>
              <SelectItem value="meeting">Reunión</SelectItem>
              <SelectItem value="call">Llamada</SelectItem>
            </SelectContent>
          </Select>
          {noteKind === 'meeting' && <p className="text-[11px] text-muted-foreground self-center">Pasa el contacto a "Reunión hecha"</p>}
        </div>
        <Textarea
          rows={3}
          placeholder="Qué se habló, qué necesita, próximos pasos..."
          value={noteBody}
          onChange={e => setNoteBody(e.target.value)}
        />
        <Button size="sm" variant="secondary" onClick={addNote} disabled={!noteBody.trim()}>Agregar nota</Button>

        <div className="space-y-2 pt-2">
          {notes.map(n => (
            <div key={n.id} className={cn('rounded-md border p-2 text-sm', (n.kind === 'stage' || n.kind === 'system') && 'bg-muted/40 text-muted-foreground text-xs')}>
              <p className="text-[11px] text-muted-foreground mb-0.5">
                {NOTE_KINDS[n.kind] ?? n.kind} · {fmt(n.created_at)}{n.created_by && users[n.created_by] ? ` · ${users[n.created_by]}` : ''}
              </p>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-muted-foreground">Sin notas todavía.</p>}
        </div>
      </div>

      {extra && extra.meetings.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Reuniones agendadas</p>
          {extra.meetings.map(m => (
            <p key={m.id} className="text-xs text-muted-foreground">
              {String(m.meeting_date).split('-').slice(1).concat(String(m.meeting_date).slice(0, 4)).join('/')} · {m.meeting_time}
              {m.comments ? ` — ${m.comments}` : ''}
            </p>
          ))}
        </div>
      )}

      {extra && extra.chat.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Conversación de WhatsApp (asistente)</p>
          <div className="space-y-1 max-h-64 overflow-y-auto rounded-md border p-2 bg-muted/20">
            {extra.chat.map((m, i) => (
              <p key={i} className={cn('text-xs rounded px-2 py-1 max-w-[85%] whitespace-pre-wrap', m.role === 'user' ? 'bg-card border' : 'bg-green-100 dark:bg-green-900/40 ml-auto')}>
                {m.content}
              </p>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function NewContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '', service: '' });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Escribe el nombre'); return; }
    const key = form.phone.replace(/\D/g, '').slice(-10);
    const contacts = qc.getQueryData<CrmContact[]>(['crm_contacts']) ?? [];
    if (key.length === 10 && contacts.some(c => c.phone_key === key)) { toast.error('Ya hay un contacto con ese teléfono'); return; }
    setSaving(true);
    const tenantId = await getTenantId();
    const { error } = await supabase.from('crm_contacts' as any).insert({
      tenant_id: tenantId, name: form.name.trim(), phone: form.phone.trim() || null,
      vehicle: form.vehicle.trim() || null, service: form.service.trim() || null, source: 'manual', stage: 'new',
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setForm({ name: '', phone: '', vehicle: '', service: '' });
    qc.invalidateQueries({ queryKey: ['crm_contacts'] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nuevo contacto</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {(['name', 'phone'] as const).map(k => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{{ name: 'Nombre', phone: 'Teléfono' }[k]}</Label>
              <Input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          {([['vehicle', 'Vehículo', VEHICLES], ['service', 'Servicio de interés', SERVICES]] as const).map(([k, label, options]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Select value={form[k] || undefined} onValueChange={v => setForm(f => ({ ...f, [k]: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CRM() {
  const qc = useQueryClient();
  const { data: contacts = [], isLoading } = useContacts();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (qd.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(qd)) ||
      (c.vehicle ?? '').toLowerCase().includes(q) ||
      (c.service ?? '').toLowerCase().includes(q));
  }, [contacts, search]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map(s => [s.id, [] as CrmContact[]])) as Record<Stage, CrmContact[]>;
    for (const c of filtered) (map[c.stage] ?? map.new).push(c);
    // Primero los vencidos, luego por próxima acción, luego los más recientes
    for (const list of Object.values(map)) {
      list.sort((a, b) => {
        const oa = isOverdue(a) ? 0 : 1, ob = isOverdue(b) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        if (a.next_action_at && b.next_action_at) return a.next_action_at.localeCompare(b.next_action_at);
        if (a.next_action_at || b.next_action_at) return a.next_action_at ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
    }
    return map;
  }, [filtered]);

  const moveTo = async (id: string, stage: Stage) => {
    const c = contacts.find(x => x.id === id);
    if (!c || c.stage === stage) return;
    qc.setQueryData<CrmContact[]>(['crm_contacts'], list => (list ?? []).map(x => x.id === id ? { ...x, stage } : x));
    const { error } = await supabase.from('crm_contacts' as any).update({ stage } as any).eq('id', id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['crm_contacts'] });
  };

  const openContact = contacts.find(c => c.id === openId) ?? null;
  const active = contacts.filter(c => c.stage !== 'client' && c.stage !== 'lost');
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2"><Contact className="h-6 w-6 text-primary" /> CRM</h1>
          <p className="page-description">Personas que nos contactan, reuniones, notas y seguimiento</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar nombre, teléfono..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
          </div>
          <Button className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Contacto</Button>
        </div>
      </div>

      <StatTiles tiles={[
        { label: 'En proceso', value: active.length, icon: UsersIcon, tint: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
        { label: 'Reuniones agendadas', value: contacts.filter(c => c.stage === 'meeting_scheduled').length, icon: CalendarCheck, tint: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
        { label: 'Seguimientos vencidos', value: contacts.filter(isOverdue).length, icon: AlertCircle, tint: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
        { label: 'Clientes este mes', value: contacts.filter(c => c.stage === 'client' && new Date(c.updated_at) >= monthStart).length, icon: Trophy, tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
      ]} />

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(s => (
            <div
              key={s.id}
              onDragOver={e => { e.preventDefault(); setDragOver(s.id); }}
              onDragLeave={() => setDragOver(d => (d === s.id ? null : d))}
              onDrop={e => { e.preventDefault(); setDragOver(null); moveTo(e.dataTransfer.getData('text/plain'), s.id); }}
              className={cn('w-64 shrink-0 rounded-xl border border-t-4 bg-muted/30 flex flex-col max-h-[70vh]', s.tint, dragOver === s.id && 'ring-2 ring-primary/40')}
            >
              <div className="px-3 py-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{s.label}</p>
                <span className="text-xs text-muted-foreground">{byStage[s.id].length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 overflow-y-auto flex-1">
                {byStage[s.id].map(c => <ContactCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!openContact} onOpenChange={v => !v && setOpenId(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
          {openContact && (
            <>
              <DialogHeader>
                <DialogTitle>{openContact.name || openContact.phone}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {STAGE_LABEL[openContact.stage]} · Llegó por {(SOURCE[openContact.source] ?? SOURCE.manual).label} el {fmt(openContact.created_at)}
                </p>
              </DialogHeader>
              <ContactDetail key={openContact.id} contact={openContact} onClose={() => setOpenId(null)} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <NewContactDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

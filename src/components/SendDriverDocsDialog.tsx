import { useEffect, useState } from 'react';
import { Loader2, Send, MessageCircle, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('driver-docs-send', { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}

/** Enviar al driver sus documentos firmados (leasing, W9, service agreement) por WhatsApp (grupo) y/o email */
export function SendDriverDocsDialog({ driver, open, onOpenChange }: {
  driver: { id: string; name: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [docs, setDocs] = useState<{ key: string; label: string }[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [useWa, setUseWa] = useState(true);
  const [useEmail, setUseEmail] = useState(false);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDocs(null);
    const first = driver.name.trim().split(/\s+/)[0] || '';
    setCaption(`Hola ${first}, aquí tienes copia de tus documentos firmados con 58 Logistics 📄`);
    call({ action: 'list', driver_id: driver.id })
      .then(r => {
        setDocs(r.docs);
        setSelected(new Set(r.docs.map((d: any) => d.key)));
        setEmail(r.email);
        setGroup(r.group);
        setUseWa(!!r.group);
        setUseEmail(!r.group && !!r.email);
      })
      .catch(e => { toast({ title: 'Error', description: e.message, variant: 'destructive' }); setDocs([]); });
  }, [open, driver.id, driver.name]);

  const toggle = (k: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const send = async () => {
    const channels = [useWa && 'whatsapp', useEmail && 'email'].filter(Boolean);
    setSending(true);
    try {
      const r = await call({ driver_id: driver.id, keys: [...selected], channels, caption });
      const parts = Object.entries(r.result as Record<string, { ok: boolean; error?: string }>);
      const failed = parts.filter(([, v]) => !v.ok);
      if (failed.length === 0) {
        toast({ title: 'Documentos enviados', description: parts.map(([k]) => (k === 'whatsapp' ? `WhatsApp: ${group}` : `Email: ${email}`)).join(' · ') });
        onOpenChange(false);
      } else {
        toast({ title: 'No se envió todo', description: failed.map(([k, v]) => `${k === 'whatsapp' ? 'WhatsApp' : 'Email'}: ${v.error}`).join(' · '), variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const emailOk = !!email && /@/.test(email) && !email.endsWith('@onboarding.local');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-32px)] rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal">Enviar documentos</DialogTitle>
          <DialogDescription>Copia de los documentos firmados para {driver.name}.</DialogDescription>
        </DialogHeader>

        {docs === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#0b57d0]" /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-[#444746] py-2">Este driver no tiene leasing, W9 ni service agreement cargados.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border divide-y divide-[#f0f0f0] dark:divide-border">
              {docs.map(d => (
                <label key={d.key} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm">
                  <Checkbox checked={selected.has(d.key)} onCheckedChange={() => toggle(d.key)} />
                  {d.label}
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#444746]">Enviar por</p>
              <label className={`flex items-center gap-3 rounded-2xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-2.5 text-sm ${group ? 'cursor-pointer' : 'opacity-50'}`}>
                <Checkbox checked={useWa} disabled={!group} onCheckedChange={v => setUseWa(!!v)} />
                <MessageCircle className="h-4 w-4 text-[#1e8e3e]" />
                <span className="min-w-0 truncate">WhatsApp · {group ?? 'sin grupo vinculado'}</span>
              </label>
              <label className={`flex items-center gap-3 rounded-2xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-2.5 text-sm ${emailOk ? 'cursor-pointer' : 'opacity-50'}`}>
                <Checkbox checked={useEmail} disabled={!emailOk} onCheckedChange={v => setUseEmail(!!v)} />
                <Mail className="h-4 w-4 text-[#0b57d0]" />
                <span className="min-w-0 truncate">Email · {emailOk ? email : 'sin email'}</span>
              </label>
            </div>

            {useWa && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#444746]">Mensaje de WhatsApp</p>
                <Textarea className="min-h-[70px] text-sm bg-white dark:bg-card rounded-lg" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
              <Button className="rounded-full gap-2" onClick={send} disabled={sending || selected.size === 0 || (!useWa && !useEmail)}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

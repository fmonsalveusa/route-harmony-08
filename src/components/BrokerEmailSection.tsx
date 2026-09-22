import { useCallback, useEffect, useState } from 'react';
import { Mail, Search, Loader2, CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BrokerEmailRowView, formatET, type BrokerEmailRow } from '@/components/whatsapp/BrokerEmailHistory';

interface Candidate {
  account: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  messages: number;
}

interface ThreadLink {
  status: 'linked' | 'ambiguous' | 'not_found';
  link_mode: 'auto' | 'manual' | null;
  account: string | null;
  thread_id: string | null;
  subject: string | null;
  candidates: Candidate[];
}

async function callBrokerEmail(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('broker-email', { body });
  if (error || data?.error) throw new Error(data?.error || error?.message);
  return data;
}

/** Hilo de Gmail de la carga y emails enviados al broker */
export function BrokerEmailSection({ loadId }: { loadId: string }) {
  const [link, setLink] = useState<ThreadLink | null>(null);
  const [emails, setEmails] = useState<BrokerEmailRow[]>([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase.from('load_email_threads' as any).select('*').eq('load_id', loadId).maybeSingle(),
      supabase.from('broker_email_queue' as any).select('*').eq('load_id', loadId).order('created_at', { ascending: false }),
    ]);
    setLink((t as any) ?? null);
    setEmails(((e as any[]) || []) as BrokerEmailRow[]);
  }, [loadId]);

  useEffect(() => { void load(); }, [load]);

  const search = async (text: string) => {
    setBusy('search');
    try {
      const data = await callBrokerEmail({ action: 'search', load_id: loadId, query: text });
      setResults(data.candidates ?? []);
    } catch (e: any) {
      toast.error(`No se pudo buscar en Gmail: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (c: Candidate) => {
    setBusy(c.threadId);
    try {
      const data = await callBrokerEmail({ action: 'link', load_id: loadId, account: c.account, thread_id: c.threadId, subject: c.subject });
      const sent = (data.sent ?? []).filter((r: any) => r.status === 'sent').length;
      toast.success(sent > 0 ? `Hilo enlazado. Se enviaron ${sent} email(s) pendientes.` : 'Hilo enlazado');
      setPicking(false);
      setResults(null);
      await load();
    } catch (e: any) {
      toast.error(`No se pudo enlazar: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const retry = async (id: string) => {
    setBusy(id);
    try {
      await callBrokerEmail({ action: 'retry', load_id: loadId, id });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const openPicker = () => {
    setPicking(true);
    setResults(link?.status === 'ambiguous' ? link.candidates : null);
  };

  const candidates = picking ? results : null;

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="font-semibold text-sm flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email al broker</h5>
        {!picking && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openPicker}>
            {link?.status === 'linked' ? 'Cambiar hilo' : 'Elegir hilo'}
          </Button>
        )}
      </div>

      {/* Estado del hilo */}
      {!picking && (
        link?.status === 'linked' ? (
          <div className="flex items-start gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{link.subject || '(sin asunto)'}</p>
              <p className="text-muted-foreground">
                {link.link_mode === 'auto' ? 'Enlazado automáticamente' : 'Enlazado a mano'} · {link.account}
              </p>
            </div>
          </div>
        ) : link?.status === 'ambiguous' ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Hay {link.candidates.length} hilos con este número de carga. Elige el correcto.
          </p>
        ) : link?.status === 'not_found' ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> No se encontró el hilo en Gmail. Búscalo y enlázalo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">El hilo se busca solo por el número de carga cuando sale el primer aviso.</p>
        )
      )}

      {/* Buscar y elegir hilo */}
      {picking && (
        <div className="space-y-2">
          <form
            className="flex gap-2"
            onSubmit={e => { e.preventDefault(); void search(query); }}
          >
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Vacío = número de carga. También: broker, asunto, from:correo..."
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" className="h-8 gap-1 text-xs" disabled={busy !== null}>
              {busy === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setPicking(false); setResults(null); }}>
              Cancelar
            </Button>
          </form>
          {candidates && candidates.length === 0 && <p className="text-xs text-muted-foreground">Sin resultados.</p>}
          {candidates && candidates.length > 0 && (
            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
              {candidates.map(c => (
                <button
                  key={`${c.account}:${c.threadId}`}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => choose(c)}
                  className="w-full text-left px-2.5 py-2 hover:bg-muted/50 disabled:opacity-60"
                >
                  <p className="text-xs font-medium truncate">{c.subject || '(sin asunto)'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.from} · {formatET(c.date)} · {c.messages} msj · {c.account}
                    {busy === c.threadId && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Emails de esta carga */}
      {emails.length > 0 && (
        <div className="rounded-md border divide-y -mx-0.5">
          {emails.map(r => (
            <BrokerEmailRowView
              key={r.id}
              row={r}
              action={['failed', 'skipped'].includes(r.status) ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" disabled={busy !== null} onClick={() => retry(r.id)}>
                  {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />} Reenviar
                </Button>
              ) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

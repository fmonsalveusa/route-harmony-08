import { useCallback, useEffect, useState } from 'react';
import { Mail, Search, Loader2, CheckCircle2, AlertTriangle, RotateCw, Send, CircleDashed, Plus, X, Link2 } from 'lucide-react';
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
  /** Hilos adicionales enlazados a mano: los avisos se responden también ahí */
  extra_threads?: { account: string; thread_id: string; subject: string | null }[];
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
  // 'main' = elegir/cambiar el hilo principal · 'extra' = agregar otro hilo
  const [pickMode, setPickMode] = useState<'main' | 'extra'>('main');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searchInfo, setSearchInfo] = useState<{ accounts: string[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: t, error: tErr }, { data: e }] = await Promise.all([
      supabase.from('load_email_threads' as any).select('*').eq('load_id', loadId).maybeSingle(),
      supabase.from('broker_email_queue' as any).select('*').eq('load_id', loadId).order('created_at', { ascending: false }),
    ]);
    if (tErr) {
      // Sin esto, un error de lectura (permisos, red) se veía igual que "sin hilo asignado"
      console.error('load_email_threads read failed:', tErr);
      setLinkError(tErr.message);
    } else {
      setLinkError(null);
    }
    setLink((t as any) ?? null);
    setEmails(((e as any[]) || []) as BrokerEmailRow[]);
  }, [loadId]);

  // Faltaba esto: sin cargarlo al abrir, la sección se veía siempre como "sin hilo"
  // hasta que se hacía alguna acción (enlazar, reenviar) que sí llama a load().
  useEffect(() => { void load(); }, [load]);

  const search = async (text: string) => {
    setBusy('search');
    try {
      const data = await callBrokerEmail({ action: 'search', load_id: loadId, query: text });
      setResults(data.candidates ?? []);
      setSearchInfo({ accounts: data.accounts ?? [], errors: data.errors ?? [] });
    } catch (e: any) {
      toast.error(`No se pudo buscar en Gmail: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (c: Candidate) => {
    if (pickMode === 'extra') return addExtra(c);
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

  const addExtra = async (c: Candidate) => {
    setBusy(c.threadId);
    try {
      await callBrokerEmail({ action: 'add_thread', load_id: loadId, account: c.account, thread_id: c.threadId, subject: c.subject });
      toast.success('Hilo agregado. Los próximos avisos también se responden ahí.');
      setPicking(false);
      setResults(null);
      await load();
    } catch (e: any) {
      toast.error(`No se pudo agregar: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const removeExtra = async (threadId: string, subject: string | null) => {
    if (!window.confirm(`¿Quitar el hilo "${subject || '(sin asunto)'}" de esta carga?`)) return;
    setBusy(threadId);
    try {
      await callBrokerEmail({ action: 'remove_thread', load_id: loadId, thread_id: threadId });
      toast.success('Hilo quitado');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const run = async (action: 'retry' | 'send_now', id: string) => {
    setBusy(id);
    try {
      const data = await callBrokerEmail({ action, load_id: loadId, id });
      const result = (data.sent ?? []).find((r: any) => r.id === id);
      if (result?.status === 'sent') toast.success('Email enviado');
      else if (result?.error) toast.error(result.error);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const openPicker = (mode: 'main' | 'extra' = 'main') => {
    setPickMode(mode);
    setPicking(true);
    setResults(mode === 'main' && link?.status === 'ambiguous' ? link.candidates : null);
  };
  const extras = link?.extra_threads ?? [];

  const candidates = picking ? results : null;

  return (
    <div className="px-4 py-3 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground flex items-center gap-1.5"><Mail className="h-4 w-4 text-[#0b57d0] dark:text-blue-300" /> Email Al Broker</h5>
        {!picking && (
          <div className="flex items-center gap-1.5">
            {link?.status === 'linked' && (
              <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs gap-1 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => openPicker('extra')} title="Los avisos al broker también se responden en este hilo">
                <Plus className="h-3.5 w-3.5" /> Agregar Hilo
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => openPicker('main')}>
              {link?.status === 'linked' ? 'Cambiar Hilo' : 'Elegir Hilo'}
            </Button>
          </div>
        )}
      </div>

      {/* Estado del hilo */}
      {!picking && (
        linkError ? (
          <p className="flex items-center gap-1.5 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> No se pudo leer el hilo: {linkError}
          </p>
        ) : link?.status === 'linked' ? (
          <div className="flex items-start gap-1.5 text-xs bg-green-50 border border-green-200 rounded-md px-2 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-green-900 truncate">Hilo Asignado: {link.subject || '(sin asunto)'}</p>
              <p className="text-green-700">
                {link.link_mode === 'auto' ? 'Enlazado Automáticamente' : 'Enlazado A Mano'} · {link.account}
              </p>
            </div>
          </div>
        ) : null
      )}

      {/* Hilos adicionales (agregados a mano) */}
      {!picking && !linkError && link?.status === 'linked' && extras.length > 0 && (
        <div className="space-y-1">
          {extras.map(x => (
            <div key={x.thread_id} className="flex items-center gap-1.5 text-xs bg-[#e8f0fe] dark:bg-blue-950/40 rounded-md px-2 py-1.5">
              <Link2 className="h-3.5 w-3.5 text-[#0b57d0] dark:text-blue-300 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#041e49] dark:text-blue-100 truncate">Hilo Adicional: {x.subject || '(sin asunto)'}</p>
                <p className="text-[#0b57d0] dark:text-blue-300 truncate">Agregado A Mano · {x.account}</p>
              </div>
              <button type="button" title="Quitar este hilo" disabled={busy !== null} onClick={() => removeExtra(x.thread_id, x.subject)}
                className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[#b3261e] hover:bg-[#fce8e6] disabled:opacity-50">
                {busy === x.thread_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {!picking && (
        linkError || link?.status === 'linked' ? null : link?.status === 'ambiguous' ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Hay {link.candidates.length} hilos con este número de carga. Elige el correcto.
          </p>
        ) : link?.status === 'not_found' ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> No se encontró el hilo en Gmail. Búscalo y enlázalo.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleDashed className="h-3.5 w-3.5 flex-shrink-0" /> Sin hilo asignado todavía. Se busca solo por el número de carga cuando sale el primer aviso.
          </p>
        )
      )}

      {/* Buscar y elegir hilo */}
      {picking && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground">
            {pickMode === 'extra' ? 'Agregar otro hilo: los avisos al broker también se responderán ahí' : 'Elegir el hilo principal de la carga'}
          </p>
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
          {candidates && searchInfo && (
            <div className="text-[11px] space-y-0.5">
              <p className="text-muted-foreground">Buscado en: {searchInfo.accounts.join(', ') || 'ninguna cuenta'}</p>
              {searchInfo.errors.map(err => <p key={err} className="text-red-700">⚠ {err}</p>)}
            </div>
          )}
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
              action={['pending', 'waiting_thread'].includes(r.status) ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" disabled={busy !== null} onClick={() => run('send_now', r.id)}>
                  {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Enviar Ahora
                </Button>
              ) : ['failed', 'skipped'].includes(r.status) ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" disabled={busy !== null} onClick={() => run('retry', r.id)}>
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

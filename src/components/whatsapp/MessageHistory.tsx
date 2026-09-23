import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { TEMPLATE_TITLES } from '../../../supabase/functions/_shared/templateDefaults';

interface HistoryRow {
  id: string;
  template_key: string;
  recipient_type: string | null;
  recipient_name: string | null;
  message: string | null;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  reference: string | null;
  created_at: string;
}

const EXTRA_TITLES: Record<string, string> = {
  admin_report: 'Reporte diario de administración',
  test: 'Mensaje de prueba',
  broadcast: 'Mensaje masivo',
};

const titleOf = (key: string) => TEMPLATE_TITLES[key] ?? EXTRA_TITLES[key] ?? key;

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Falló', className: 'bg-red-100 text-red-800' },
  skipped: { label: 'No enviado', className: 'bg-amber-100 text-amber-800' },
};

const TYPE_LABELS: Record<string, string> = {
  driver: 'Driver', investor: 'Investor', dispatcher: 'Dispatcher', admin: 'Administración', test: 'Prueba', meetings: 'Reuniones', broadcast: 'Mensaje masivo',
};

const formatET = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit',
  });

export function MessageHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_message_history' as any)
      .select('id, template_key, recipient_type, recipient_name, message, status, error, reference, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    setRows(((data as any[]) || []) as HistoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const kinds = useMemo(() => [...new Set(rows.map(r => r.template_key))].sort((a, b) => titleOf(a).localeCompare(titleOf(b))), [rows]);

  const visible = rows.filter(r =>
    (status === 'all' || r.status === status) &&
    (kind === 'all' || r.template_key === kind) &&
    (!search || [r.recipient_name, r.reference, r.message].some(x => (x || '').toLowerCase().includes(search.toLowerCase())))
  );

  const failed = rows.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar carga, nombre..." className="h-8 w-52 pl-8 text-xs" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Fallidos{failed ? ` (${failed})` : ''}</SelectItem>
            <SelectItem value="skipped">No enviados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los avisos</SelectItem>
            {kinds.map(k => <SelectItem key={k} value={k}>{titleOf(k)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            {loading ? 'Cargando...' : 'No hay mensajes registrados'}
          </p>
        )}
        {visible.map(r => {
          const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.skipped;
          const isOpen = expanded === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full text-left px-3 py-2 hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[11px] text-muted-foreground w-28 flex-shrink-0">{formatET(r.created_at)}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.className}`}>{style.label}</span>
                <span className="text-sm font-medium">{titleOf(r.template_key)}</span>
                <span className="text-xs text-muted-foreground">
                  {[r.recipient_type ? TYPE_LABELS[r.recipient_type] ?? r.recipient_type : null, r.recipient_name, r.reference].filter(Boolean).join(' · ')}
                </span>
              </div>
              {r.error && <p className="text-xs text-red-700 mt-1">{r.error}</p>}
              {isOpen && r.message && (
                <p className="mt-2 rounded-md bg-[#dcf8c6] dark:bg-green-950/40 px-3 py-2 text-sm whitespace-pre-wrap">{r.message}</p>
              )}
            </button>
          );
        })}
      </div>
      {rows.length >= 500 && <p className="text-[11px] text-muted-foreground">Se muestran los últimos 500 mensajes.</p>}
    </div>
  );
}

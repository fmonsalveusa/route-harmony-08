import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export interface BrokerEmailRow {
  id: string;
  load_id: string;
  kind: 'arrival' | 'docs';
  stop_type: string;
  stop_order: number;
  city: string | null;
  message_key?: string | null;
  status: 'pending' | 'sending' | 'waiting_thread' | 'sent' | 'failed' | 'skipped';
  body: string | null;
  recipients: string | null;
  attachments: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  loads?: { reference_number: string | null } | null;
}

export const EMAIL_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-blue-100 text-blue-800' },
  sending: { label: 'Enviando', className: 'bg-blue-100 text-blue-800' },
  waiting_thread: { label: 'Esperando hilo', className: 'bg-amber-100 text-amber-800' },
  sent: { label: 'Enviado', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Falló', className: 'bg-red-100 text-red-800' },
  skipped: { label: 'No enviado', className: 'bg-gray-100 text-gray-700' },
};

export const emailTitle = (r: Pick<BrokerEmailRow, 'kind' | 'stop_type' | 'city' | 'message_key'>) =>
  `${r.kind === 'arrival' ? 'Llegada' : r.message_key?.includes(':update:') ? 'Documentos actualizados' : 'Fotos y documentos'} · ${r.stop_type === 'pickup' ? 'Pickup' : 'Entrega'}${r.city ? ` ${r.city}` : ''}`;

export const formatET = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' });

export function BrokerEmailRowView({ row, showLoad, action }: { row: BrokerEmailRow; showLoad?: boolean; action?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const style = EMAIL_STATUS[row.status] ?? EMAIL_STATUS.skipped;
  return (
    <div className="px-3 py-2 hover:bg-muted/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left min-w-0" onClick={() => setOpen(!open)}>
          <span className="text-[11px] text-muted-foreground w-28 flex-shrink-0">{formatET(row.sent_at || row.created_at)}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.className}`}>{style.label}</span>
          <span className="text-sm font-medium">{emailTitle(row)}</span>
          {showLoad && row.loads?.reference_number && <span className="text-xs text-muted-foreground">Carga #{row.loads.reference_number}</span>}
        </button>
        {action}
      </div>
      {row.error && <p className="text-xs text-red-700 mt-1">{row.error}</p>}
      {open && (
        <div className="mt-2 space-y-1 text-xs">
          {row.recipients && <p><span className="text-muted-foreground">Para:</span> {row.recipients}</p>}
          {row.attachments && <p><span className="text-muted-foreground">Adjuntos:</span> {row.attachments}</p>}
          {row.body && <p className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{row.body}</p>}
        </div>
      )}
    </div>
  );
}

export function BrokerEmailHistory() {
  const [rows, setRows] = useState<BrokerEmailRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('broker_email_queue' as any)
      .select('*, loads(reference_number)')
      .order('created_at', { ascending: false })
      .limit(300);
    setRows(((data as any[]) || []) as BrokerEmailRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Emails enviados al broker</p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>
      <div className="rounded-lg border divide-y">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">{loading ? 'Cargando...' : 'Todavía no hay emails'}</p>
        )}
        {rows.map(r => <BrokerEmailRowView key={r.id} row={r} showLoad />)}
      </div>
    </div>
  );
}

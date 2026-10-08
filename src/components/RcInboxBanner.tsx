import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, ChevronDown, Eye, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewerDialog } from '@/components/PdfViewerDialog';
import type { RcDraft } from '@/components/LoadFormDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InboxRow extends RcDraft {
  reference_number: string | null;
  broker: string | null;
  origin: string | null;
  destination: string | null;
  pickup_date: string | null;
  total_rate: number | null;
  from_email: string | null;
  received_at: string | null;
  created_at: string;
}

/** "Cincinnati, OH" a partir de una dirección completa */
const cityState = (a: string | null) => {
  if (!a) return '—';
  const m = a.match(/([^,]+),\s*([A-Z]{2})\b/);
  return m ? `${m[1].trim().replace(/^\d+\s+/, '')}, ${m[2]}` : a;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' });

/** Rate confirmations que llegaron por email y todavía no son carga */
export function RcInboxBanner({ onCreate }: { onCreate: (draft: RcDraft) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ['rc_inbox'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('rc_inbox' as any)
        .select('id, pdf_path, pdf_name, extracted, reference_number, broker, origin, destination, pickup_date, total_rate, from_email, received_at, created_at')
        .eq('status', 'pending').order('created_at', { ascending: false });
      return (data ?? []) as unknown as InboxRow[];
    },
  });

  if (rows.length === 0) return null;

  const view = async (r: InboxRow) => {
    const { data } = await supabase.storage.from('driver-documents').createSignedUrl(r.pdf_path, 3600);
    if (data?.signedUrl) setViewer({ url: data.signedUrl, title: `RC · ${r.broker ?? ''} #${r.reference_number ?? ''}` });
  };

  const discard = async (r: InboxRow) => {
    if (!window.confirm(`¿Descartar el RC #${r.reference_number ?? ''}${r.broker ? ` de ${r.broker}` : ''}?`)) return;
    setBusy(r.id);
    const { data, error } = await supabase.functions.invoke('rc-inbox', { body: { action: 'discard', id: r.id } });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    qc.invalidateQueries({ queryKey: ['rc_inbox'] });
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
      <button type="button" className="w-full flex items-center gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(o => !o)}>
        <Inbox className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Rate confirmations recibidos ({rows.length})</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· llegaron por email y todavía no son carga</span>
        <ChevronDown className={cn('h-4 w-4 ml-auto text-muted-foreground transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="divide-y border-t">
          {rows.map(r => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {r.broker ?? 'Broker'} · #{r.reference_number ?? '—'}
                  {r.total_rate ? <span className="ml-2 text-green-700 dark:text-green-400">${Number(r.total_rate).toLocaleString()}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cityState(r.origin)} → {cityState(r.destination)}
                  {r.pickup_date ? ` · Pickup ${r.pickup_date}` : ''}
                  {` · recibido ${fmt(r.received_at ?? r.created_at)}`}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => view(r)}>
                  <Eye className="h-3.5 w-3.5" /> Ver
                </Button>
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onCreate(r)}>
                  <Plus className="h-3.5 w-3.5" /> Crear carga
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => discard(r)} disabled={busy === r.id} title="Descartar">
                  {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <PdfViewerDialog url={viewer?.url ?? null} title={viewer?.title ?? ''} onClose={() => setViewer(null)} />
    </div>
  );
}

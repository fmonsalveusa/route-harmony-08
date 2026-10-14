import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RecipientType = 'driver' | 'investor' | 'dispatcher';

interface Row {
  key: string;
  name: string;
  serviceType: string;
  email: string;
  address: string;
  payments: number;
  loads: number;
  loadedMiles: number;
  emptyMiles: number;
  gross: number;
  adjustments: number;
  net: number;
}

const SERVICE: Record<string, string> = {
  owner_operator: 'Owner Operator', company_driver: 'Company Driver', dispatch_service: 'Dispatch Service',
};
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const int = (n: number) => Math.round(n).toLocaleString('en-US');

/** Trae todas las filas (PostgREST corta en 1000) */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...((data as T[]) ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Consulta por ids en bloques (la URL tiene límite) */
async function fetchByIds<T>(ids: string[], build: (chunk: string[]) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await build(ids.slice(i, i + 100));
    if (error) throw error;
    out.push(...((data as T[]) ?? []));
  }
  return out;
}

/**
 * Reporte anual para los 1099: lo pagado en el año (por fecha de pago) a cada driver, investor o
 * dispatcher, con sus cargas y millas. Se puede filtrar por la empresa que pagó (la de la carga).
 */
export function AnnualPaymentsReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [type, setType] = useState<RecipientType>('driver');
  const [company, setCompany] = useState('all');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ payments: any[]; adj: Record<string, number>; loads: Record<string, any>; people: Record<string, any> } | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from('companies').select('id, name').order('name').then(({ data }) => setCompanies((data as any[]) ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const payments = await fetchAll<any>((from, to) => supabase
          .from('payments').select('id, load_id, recipient_id, recipient_name, amount, payment_date')
          .eq('status', 'paid').eq('recipient_type', type)
          .gte('payment_date', `${year}-01-01`).lte('payment_date', `${year}-12-31T23:59:59`)
          .order('payment_date').range(from, to));
        const ids = payments.map(p => p.id);
        const loadIds = [...new Set(payments.map(p => p.load_id).filter(Boolean))] as string[];
        const recipientIds = [...new Set(payments.map(p => p.recipient_id).filter(Boolean))] as string[];
        const table = type === 'driver' ? 'drivers' : type === 'investor' ? 'investors' : 'dispatchers';
        const [adjRows, loadRows, peopleRows] = await Promise.all([
          fetchByIds<any>(ids, c => supabase.from('payment_adjustments' as any).select('payment_id, adjustment_type, amount').in('payment_id', c)),
          fetchByIds<any>(loadIds, c => supabase.from('loads').select('id, miles, empty_miles, company_id').in('id', c)),
          fetchByIds<any>(recipientIds, c => supabase.from(table as any).select('*').in('id', c)),
        ]);
        const adj: Record<string, number> = {};
        for (const a of adjRows) adj[a.payment_id] = (adj[a.payment_id] ?? 0) + (a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount));
        if (!cancelled) setData({
          payments, adj,
          loads: Object.fromEntries(loadRows.map(l => [l.id, l])),
          people: Object.fromEntries(peopleRows.map(p => [p.id, p])),
        });
      } catch (e: any) {
        if (!cancelled) toast.error(`No se pudo armar el reporte: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, year, type]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const map = new Map<string, Row & { loadSet: Set<string> }>();
    for (const p of data.payments) {
      const load = p.load_id ? data.loads[p.load_id] : null;
      // Por empresa: la de la carga. Los pagos manuales sin carga solo salen en "Todas"
      if (company !== 'all' && load?.company_id !== company) continue;
      const key = p.recipient_id || `name:${(p.recipient_name ?? '').trim().toLowerCase()}`;
      const person = p.recipient_id ? data.people[p.recipient_id] : null;
      let r = map.get(key);
      if (!r) {
        r = {
          key, name: (person?.name ?? p.recipient_name ?? '—').trim(),
          serviceType: SERVICE[person?.service_type] ?? person?.service_type ?? '',
          email: person?.email ?? '', address: person?.address ?? '',
          payments: 0, loads: 0, loadedMiles: 0, emptyMiles: 0, gross: 0, adjustments: 0, net: 0, loadSet: new Set(),
        };
        map.set(key, r);
      }
      const amount = Number(p.amount) || 0, a = data.adj[p.id] ?? 0;
      r.payments += 1;
      r.gross += amount;
      r.adjustments += a;
      r.net += amount + a;
      // Las millas de cada carga se cuentan una sola vez por persona
      if (load && !r.loadSet.has(load.id)) {
        r.loadSet.add(load.id);
        r.loads += 1;
        r.loadedMiles += Number(load.miles) || 0;
        r.emptyMiles += Number(load.empty_miles) || 0;
      }
    }
    return [...map.values()].map(({ loadSet: _s, ...r }) => r).sort((a, b) => b.gross - a.gross);
  }, [data, company]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    loads: t.loads + r.loads, loaded: t.loaded + r.loadedMiles, empty: t.empty + r.emptyMiles,
    gross: t.gross + r.gross, adj: t.adj + r.adjustments, net: t.net + r.net,
  }), { loads: 0, loaded: 0, empty: 0, gross: 0, adj: 0, net: 0 }), [rows]);

  const companyName = company === 'all' ? 'Todas' : companies.find(c => c.id === company)?.name ?? '';
  const showMiles = type === 'driver';

  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Nombre', ...(type === 'driver' ? ['Tipo'] : []), 'Email', 'Dirección', 'Pagos', 'Cargas',
      ...(showMiles ? ['Millas cargadas', 'Millas vacías', 'Millas totales'] : []), 'Total bruto', 'Ajustes', 'Total neto'];
    const lines = rows.map(r => [r.name, ...(type === 'driver' ? [r.serviceType] : []), r.email, r.address, r.payments, r.loads,
      ...(showMiles ? [Math.round(r.loadedMiles), Math.round(r.emptyMiles), Math.round(r.loadedMiles + r.emptyMiles)] : []),
      r.gross.toFixed(2), r.adjustments.toFixed(2), r.net.toFixed(2)].map(q).join(','));
    const csv = '﻿' + [head.map(q).join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-anual-${type}s-${year}-${companyName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Reporte anual (1099)</DialogTitle>
          <DialogDescription>
            Lo pagado en el año según la fecha de pago (solo pagos en estado Paid). Neto = bruto ± ajustes. Las millas son las de las cargas pagadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[thisYear, thisYear - 1, thisYear - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={v => setType(v as RecipientType)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="driver">Drivers</SelectItem>
              <SelectItem value="investor">Investors</SelectItem>
              <SelectItem value="dispatcher">Dispatchers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={company} onValueChange={setCompany}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No hay pagos en {year} para este filtro.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-right">Cargas</th>
                  {showMiles && <><th className="p-2 text-right">Millas cargadas</th><th className="p-2 text-right">Millas vacías</th><th className="p-2 text-right">Millas totales</th></>}
                  <th className="p-2 text-right">Total bruto</th>
                  <th className="p-2 text-right">Ajustes</th>
                  <th className="p-2 text-right">Total neto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} className="border-t">
                    <td className="p-2">
                      <p className="font-medium">{r.name}</p>
                      {(r.serviceType || r.email) && <p className="text-xs text-muted-foreground">{[r.serviceType, r.email].filter(Boolean).join(' · ')}</p>}
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.loads}</td>
                    {showMiles && <>
                      <td className="p-2 text-right tabular-nums">{int(r.loadedMiles)}</td>
                      <td className="p-2 text-right tabular-nums">{int(r.emptyMiles)}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{int(r.loadedMiles + r.emptyMiles)}</td>
                    </>}
                    <td className="p-2 text-right tabular-nums">{money(r.gross)}</td>
                    <td className={`p-2 text-right tabular-nums ${r.adjustments < 0 ? 'text-destructive' : ''}`}>{money(r.adjustments)}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{money(r.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-muted font-semibold">
                <tr className="border-t">
                  <td className="p-2">Total ({rows.length})</td>
                  <td className="p-2 text-right tabular-nums">{totals.loads}</td>
                  {showMiles && <>
                    <td className="p-2 text-right tabular-nums">{int(totals.loaded)}</td>
                    <td className="p-2 text-right tabular-nums">{int(totals.empty)}</td>
                    <td className="p-2 text-right tabular-nums">{int(totals.loaded + totals.empty)}</td>
                  </>}
                  <td className="p-2 text-right tabular-nums">{money(totals.gross)}</td>
                  <td className="p-2 text-right tabular-nums">{money(totals.adj)}</td>
                  <td className="p-2 text-right tabular-nums">{money(totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

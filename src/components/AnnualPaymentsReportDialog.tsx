import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Pencil, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getTenantId } from '@/hooks/useTenantId';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RecipientType = 'driver' | 'investor' | 'dispatcher';

interface TaxInfo { entity_type: 'individual' | 'business'; legal_name: string | null; tax_id: string | null }

interface Row {
  key: string;
  recipientId: string | null;
  w9: string | null;
  tax: TaxInfo | null;
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
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const int = (n: number) => Math.round(n).toLocaleString('en-US');
const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
/** SSN 123-45-6789, EIN 12-3456789 */
const fmtTaxId = (t: TaxInfo | null) => {
  const d = digits(t?.tax_id);
  if (d.length !== 9) return d;
  return t?.entity_type === 'business' ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
};
const maskTaxId = (t: TaxInfo | null) => {
  const d = digits(t?.tax_id);
  if (!d) return '';
  return t?.entity_type === 'business' ? `**-***${d.slice(-4)}` : `***-**-${d.slice(-4)}`;
};

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
  const [taxMap, setTaxMap] = useState<Record<string, TaxInfo>>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [readingW9, setReadingW9] = useState(false);
  const [reload, setReload] = useState(0);

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
        const [adjRows, loadRows, peopleRows, taxRows] = await Promise.all([
          fetchByIds<any>(ids, c => supabase.from('payment_adjustments' as any).select('payment_id, adjustment_type, amount').in('payment_id', c)),
          fetchByIds<any>(loadIds, c => supabase.from('loads').select('id, miles, empty_miles, company_id').in('id', c)),
          fetchByIds<any>(recipientIds, c => supabase.from(table as any).select('*').in('id', c)),
          // Solo admin y accounting la pueden leer; para el resto llega vacía
          fetchByIds<any>(recipientIds, c => supabase.from('payee_tax_info' as any).select('recipient_id, entity_type, legal_name, tax_id').eq('recipient_type', type).in('recipient_id', c)),
        ]);
        const tax: Record<string, TaxInfo> = {};
        // Investors: lo que ya tienen en su ficha (compañía + EIN) sirve de punto de partida
        if (type === 'investor') for (const p of peopleRows) {
          if (p.ein || p.business_name) tax[p.id] = { entity_type: p.ein ? 'business' : 'individual', legal_name: p.business_name ?? null, tax_id: p.ein ?? null };
        }
        for (const t of taxRows) tax[t.recipient_id] = { entity_type: t.entity_type, legal_name: t.legal_name, tax_id: t.tax_id };
        if (!cancelled) setTaxMap(tax);
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
  }, [open, year, type, reload]);

  // Lee con IA los W-9 subidos de los drivers que aún no tienen SSN/EIN
  const readPendingW9 = async () => {
    setReadingW9(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('w9-extract', { body: { all: true } });
      if (error || res?.error) throw new Error(res?.error ?? error?.message);
      const results = (res?.results ?? []) as any[];
      const ok = results.filter(r => !r.error && !r.warning).length;
      const bad = results.filter(r => r.error || r.warning);
      if (results.length === 0) toast.info('No hay W-9 pendientes de leer');
      else toast.success(`${ok} W-9 leído(s)${bad.length ? ` · ${bad.length} con problema` : ''}`, {
        description: bad.map(r => `${r.driver}: ${r.error ?? r.warning}`).join(' · ') || 'Revisa los datos en la tabla.',
      });
      setReload(n => n + 1);
    } catch (e: any) {
      toast.error(`No se pudieron leer los W-9: ${e.message}`);
    } finally {
      setReadingW9(false);
    }
  };

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
          key, recipientId: p.recipient_id ?? null, w9: person?.form_w9_url ?? person?.w9_url ?? null, tax: null,
          name: (person?.name ?? p.recipient_name ?? '—').trim(),
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
    return [...map.values()].map(({ loadSet: _s, ...r }) => ({ ...r, tax: (r.recipientId && taxMap[r.recipientId]) || null }))
      .sort((a, b) => b.gross - a.gross);
  }, [data, company, taxMap]);

  const openW9 = async (stored: string) => {
    const win = window.open('about:blank', '_blank');
    const path = stored.match(/\/driver-documents\/([^?]+)/)?.[1] ?? (stored.startsWith('http') ? null : stored);
    const { data: signed } = path
      ? await supabase.storage.from('driver-documents').createSignedUrl(decodeURIComponent(path), 3600)
      : { data: null };
    if (win) win.location.href = signed?.signedUrl ?? stored;
  };

  const saveTax = async (row: Row, t: TaxInfo) => {
    if (!row.recipientId) return;
    const id = digits(t.tax_id);
    if (id && id.length !== 9) { toast.error('El SSN o EIN debe tener 9 dígitos'); return; }
    const { error } = await supabase.from('payee_tax_info' as any).upsert({
      recipient_type: type, recipient_id: row.recipientId, tenant_id: await getTenantId(),
      entity_type: t.entity_type, legal_name: t.legal_name?.trim() || null, tax_id: id || null, updated_at: new Date().toISOString(),
    } as any, { onConflict: 'recipient_type,recipient_id' });
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    setTaxMap(prev => ({ ...prev, [row.recipientId!]: { entity_type: t.entity_type, legal_name: t.legal_name?.trim() || null, tax_id: id || null } }));
    setEditing(null);
    toast.success('Datos fiscales guardados');
  };

  const totals = useMemo(() => rows.reduce((t, r) => ({
    loads: t.loads + r.loads, loaded: t.loaded + r.loadedMiles, empty: t.empty + r.emptyMiles,
    gross: t.gross + r.gross, adj: t.adj + r.adjustments, net: t.net + r.net,
  }), { loads: 0, loaded: 0, empty: 0, gross: 0, adj: 0, net: 0 }), [rows]);

  const companyName = company === 'all' ? 'Todas' : companies.find(c => c.id === company)?.name ?? '';
  const showMiles = type === 'driver';

  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Nombre', ...(type === 'driver' ? ['Tipo'] : []), 'Persona / Compañía', 'Nombre legal', 'SSN / EIN', 'Email', 'Dirección', 'Pagos', 'Cargas',
      ...(showMiles ? ['Millas cargadas', 'Millas vacías', 'Millas totales'] : []), 'Total bruto', 'Ajustes', 'Total neto'];
    const lines = rows.map(r => [r.name, ...(type === 'driver' ? [r.serviceType] : []),
      r.tax ? (r.tax.entity_type === 'business' ? 'Compañía' : 'Persona') : '', r.tax?.legal_name ?? '', fmtTaxId(r.tax),
      r.email, r.address, r.payments, r.loads,
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
          {type === 'driver' && (
            <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={readPendingW9} disabled={readingW9 || loading}>
              {readingW9 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {readingW9 ? 'Leyendo W-9…' : 'Leer W-9 pendientes'}
            </Button>
          )}
          <Button variant="outline" size="sm" className={`${type === 'driver' ? '' : 'ml-auto '}gap-1.5`} onClick={exportCsv} disabled={loading || rows.length === 0}>
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
                  <th className="p-2 text-left">SSN / EIN</th>
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
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        {r.tax?.tax_id ? (
                          <div>
                            <p className="font-mono text-xs">{maskTaxId(r.tax)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {r.tax.entity_type === 'business' ? 'Compañía' : 'Persona'}{r.tax.legal_name ? ` · ${r.tax.legal_name}` : ''}
                            </p>
                          </div>
                        ) : <span className="text-xs text-amber-600">Falta</span>}
                        {r.recipientId && (
                          <button type="button" className="p-1 rounded hover:bg-muted text-muted-foreground" title="Editar datos fiscales" onClick={() => setEditing(r)}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {r.w9 && <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => openW9(r.w9!)}>W-9</button>}
                      </div>
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
                  <td className="p-2 text-xs font-normal text-muted-foreground">{rows.filter(r => !r.tax?.tax_id).length} sin SSN/EIN</td>
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
      {editing && <TaxInfoDialog row={editing} onClose={() => setEditing(null)} onSave={t => saveTax(editing, t)} />}
    </Dialog>
  );
}

function TaxInfoDialog({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (t: TaxInfo) => void }) {
  const [entity, setEntity] = useState<TaxInfo['entity_type']>(row.tax?.entity_type ?? 'individual');
  const [legalName, setLegalName] = useState(row.tax?.legal_name ?? '');
  const [taxId, setTaxId] = useState(fmtTaxId(row.tax));
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Datos fiscales · {row.name}</DialogTitle>
          <DialogDescription>Como aparecen en su W-9. Solo admin y accounting pueden verlos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={entity} onValueChange={v => setEntity(v as TaxInfo['entity_type'])}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">A nombre personal (SSN)</SelectItem>
              <SelectItem value="business">A nombre de compañía (EIN)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={entity === 'business' ? 'Nombre de la compañía (LLC, Inc…)' : 'Nombre legal de la persona'}
            value={legalName} onChange={e => setLegalName(e.target.value)}
          />
          <Input
            placeholder={entity === 'business' ? 'EIN (12-3456789)' : 'SSN (123-45-6789)'}
            value={taxId} onChange={e => setTaxId(e.target.value)} autoComplete="off" inputMode="numeric"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => onSave({ entity_type: entity, legal_name: legalName, tax_id: taxId })}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

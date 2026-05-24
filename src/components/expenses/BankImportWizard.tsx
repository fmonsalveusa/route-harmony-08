import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Upload, ArrowLeft, ArrowRight, FileText, CheckCircle, AlertTriangle, XCircle, Download, Ban, Plus } from 'lucide-react';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDriver } from '@/hooks/useDrivers';
import type { CreateExpenseInput, DbExpense } from '@/hooks/useExpenses';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

// ── Categorías base (siempre presentes) ─────────────────────────────────────
const BASE_CATEGORIES: { value: string; label: string; keywords: string[] }[] = [
  { value: 'fuel',        label: 'Combustible',   keywords: ["rutter's", "pilot", "love's", "loves travel", "sheetz", "flying j", "ta travel", "petro", "speedway", "circle k", "bp ", "shell ", "exxon", "chevron", "sunoco", "wawa", "7-eleven fuel", "kwik trip", "casey's", "marathon", "fuel", "diesel", "gas station"] },
  { value: 'maintenance', label: 'Mantenimiento',  keywords: ["autozone", "o'reilly", "oreilly", "napa auto", "advance auto", "pep boys", "jiffy lube", "valvoline", "firestone", "midas", "oil change", "tire kingdom", "discount tire", "goodyear", "mavis"] },
  { value: 'repair',      label: 'Reparación',     keywords: ["repair", "mechanic", "shop", "truck service", "freightliner", "kenworth", "peterbilt", "volvo truck", "navistar", "body shop", "towing", "roadside"] },
  { value: 'insurance',   label: 'Seguro',         keywords: ["insurance", "progressive", "nationwide", "state farm", "allstate", "geico", "travelers", "canal insurance", "ooida", "great west", "sentry insurance"] },
  { value: 'toll',        label: 'Toll / Peajes',  keywords: ["ezpass", "ez pass", "tollway", "turnpike", "toll", "sunpass", "ipass", "pikepass", "prepass", "peach pass", "txtag", "e-zpass"] },
  { value: 'supplies',    label: 'Insumos',        keywords: ["walmart", "dollar general", "dollar tree", "home depot", "lowes", "ace hardware", "menards", "harbor freight", "uline", "amazon", "fastenal"] },
  { value: 'other',       label: 'Otro',           keywords: [] },
];

// Tipos que se descartan automáticamente
const AUTO_DISCARD_TYPES = ['CREDIT', 'ACCT_XFER', 'MISC_CREDIT', 'ACH_CREDIT', 'QUICKPAY_CREDIT', 'PARTNERFI_TO_CHASE'];
const AUTO_DISCARD_KEYWORDS = ['zelle payment to', 'zelle payment from', 'online transfer to', 'online transfer from', 'fee', 'bank fee', 'service charge', 'monthly fee', 'wire fee', 'meiborg bros', 'meiborg'];

// ── Tipos internos ───────────────────────────────────────────────────────────
interface BankRow {
  details: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

type DiscardReason = 'credit' | 'transfer' | 'driver_payment' | 'zelle' | 'fee' | 'user' | null;
type AssignMode = 'single' | 'fleet' | null;

interface ProcessedRow extends BankRow {
  rowNum: number;
  discarded: boolean;
  discardReason: DiscardReason;
  category: string;
  notes: string;
  assignMode: AssignMode;
  truckId: string | null;
  fleetTruckIds: string[];
  fleetSplit: 'equal' | 'custom';
  customAmounts: Record<string, number>;
  isDuplicate: boolean;
  duplicateNote: string;
}

type Step = 'upload' | 'review' | 'confirm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (inputs: CreateExpenseInput[]) => Promise<boolean>;
  trucks: DbTruck[];
  drivers: DbDriver[];
  existingExpenses: DbExpense[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseChaseCSV(text: string): BankRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return {
      details: cols[0] || '',
      date: cols[1] || '',
      description: cols[2] || '',
      amount: Math.abs(parseFloat(cols[3]?.replace(/[,$]/g, '') || '0')),
      type: cols[4] || '',
    };
  }).filter(r => r.date && r.amount > 0);
}

function detectCategory(description: string): string {
  const desc = description.toLowerCase();
  for (const cat of BASE_CATEGORIES) {
    if (cat.keywords.some(kw => desc.includes(kw))) return cat.value;
  }
  return 'other';
}

function normalizeDriverName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function isDriverPayment(description: string, drivers: DbDriver[]): boolean {
  const desc = normalizeDriverName(description);
  return drivers.some(d => {
    const normalized = normalizeDriverName(d.name);
    // Check full name or parts
    const parts = d.name.toLowerCase().split(' ').filter(p => p.length > 3);
    return desc.includes(normalized) || parts.some(p => desc.includes(p));
  });
}

function isDuplicate(row: BankRow, existing: DbExpense[]): { is: boolean; note: string } {
  const rowDate = new Date(row.date);
  const match = existing.find(e => {
    const eDate = new Date(e.expense_date);
    const dayDiff = Math.abs((rowDate.getTime() - eDate.getTime()) / 86400000);
    const amountMatch = Math.abs(e.amount - row.amount) < 0.5;
    const descSimilar = e.description.toLowerCase().includes(row.description.toLowerCase().slice(0, 15));
    return dayDiff <= 1 && amountMatch && (descSimilar || e.total_amount === row.amount);
  });
  if (match) return { is: true, note: `Posible duplicado: ${match.description.slice(0, 40)} (${match.expense_date})` };
  return { is: false, note: '' };
}

function formatDate(raw: string): string {
  const parts = raw.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  return raw;
}

// ── Componente principal ─────────────────────────────────────────────────────
export function BankImportWizard({ open, onOpenChange, onImport, trucks, drivers, existingExpenses }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categorías custom desde Supabase
  const [customCategories, setCustomCategories] = useState<{ value: string; label: string }[]>([]);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  const allCategories = [
    ...BASE_CATEGORIES,
    ...customCategories.map(c => ({ ...c, keywords: [] })),
  ];

  // Cargar categorías custom al abrir
  useEffect(() => {
    if (!open) return;
    supabase.from('expense_categories' as any).select('value, label').order('created_at').then(({ data }) => {
      setCustomCategories((data as any[]) || []);
    });
  }, [open]);

  const saveNewCategory = async () => {
    if (!newCatLabel.trim()) return;
    setSavingCat(true);
    const value = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('expense_categories' as any).insert({ value, label: newCatLabel.trim(), tenant_id } as any);
    if (!error) {
      setCustomCategories(prev => [...prev, { value, label: newCatLabel.trim() }]);
      setNewCatLabel('');
      setShowNewCat(false);
    }
    setSavingCat(false);
  };

  const reset = () => { setStep('upload'); setFile(null); setRows([]); };

  const processFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseChaseCSV(text);

      const processed: ProcessedRow[] = parsed.map((row, i) => {
        const desc = row.description.toLowerCase();
        const type = row.type.toUpperCase();

        // Auto-discard logic
        let discarded = false;
        let discardReason: DiscardReason = null;

        if (AUTO_DISCARD_TYPES.includes(type) || row.details === 'CREDIT') {
          discarded = true; discardReason = 'credit';
        } else if (type === 'ACCT_XFER' || desc.includes('online transfer')) {
          discarded = true; discardReason = 'transfer';
        } else if (desc.includes('zelle payment')) {
          discarded = true; discardReason = 'zelle';
        } else if (type === 'FEE_TRANSACTION' || desc.includes('monthly fee') || desc.includes('service fee')) {
          discarded = true; discardReason = 'fee';
        } else if (isDriverPayment(row.description, drivers)) {
          discarded = true; discardReason = 'driver_payment';
        }

        const dupCheck = isDuplicate(row, existingExpenses);

        return {
          ...row,
          rowNum: i + 2,
          discarded,
          discardReason,
          category: detectCategory(row.description),
          notes: '',
          assignMode: null,
          truckId: null,
          fleetTruckIds: [],
          fleetSplit: 'equal',
          customAmounts: {},
          isDuplicate: dupCheck.is,
          duplicateNote: dupCheck.note,
        };
      });

      setRows(processed);
    };
    reader.readAsText(f);
  };

  const updateRow = (idx: number, updates: Partial<ProcessedRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const toggleDiscard = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx
      ? { ...r, discarded: !r.discarded, discardReason: r.discarded ? null : 'user' }
      : r));
  };

  const companyTrucks = trucks.filter(t => {
    const driver = drivers.find(d => d.truck_id === t.id);
    return driver?.service_type === 'company_driver';
  });

  const toImport = rows.filter(r => !r.discarded && !r.isDuplicate);
  const discarded = rows.filter(r => r.discarded);
  const duplicates = rows.filter(r => r.isDuplicate && !r.discarded);

  const handleImport = async () => {
    setImporting(true);
    const inputs: CreateExpenseInput[] = [];

    for (const row of toImport) {
      const date = formatDate(row.date);
      if (row.assignMode === 'fleet' && row.fleetTruckIds.length > 0) {
        // Split per truck
        for (const truckId of row.fleetTruckIds) {
          const amount = row.fleetSplit === 'equal'
            ? Math.round((row.amount / row.fleetTruckIds.length) * 100) / 100
            : (row.customAmounts[truckId] || 0);
          if (amount > 0) {
            inputs.push({
              expense_date: date,
              truck_id: truckId,
              expense_type: row.category,
              category: row.category,
              description: row.description,
              notes: row.notes || null,
              amount,
              total_amount: amount,
              payment_method: 'debit_card',
              source: 'bank_import',
            });
          }
        }
      } else {
        inputs.push({
          expense_date: date,
          truck_id: row.truckId || null,
          expense_type: row.category,
          category: row.category,
          description: row.description,
          notes: row.notes || null,
          amount: row.amount,
          total_amount: row.amount,
          payment_method: 'debit_card',
          source: 'bank_import',
        });
      }
    }

    const ok = await onImport(inputs);
    setImporting(false);
    if (ok) { reset(); onOpenChange(false); }
  };

  const discardReasonLabel: Record<string, string> = {
    credit: 'Ingreso',
    transfer: 'Transferencia interna',
    zelle: 'Zelle',
    driver_payment: 'Pago a driver',
    fee: 'Comisión bancaria',
    user: 'Descartado manualmente',
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Importar Estado de Cuenta Bancario
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-2 mb-2">
          {(['upload', 'review', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${(['upload','review','confirm'].indexOf(step) >= i) ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>1. Subir CSV</span><span>2. Revisar</span><span>3. Confirmar</span>
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Arrastra tu CSV de Chase aquí</p>
              <p className="text-sm text-muted-foreground mt-1">o haz clic para buscar</p>
              <p className="text-xs text-muted-foreground mt-2">Formato: Chase Activity CSV</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            </div>
            {file && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{rows.length} transacciones detectadas</p>
                    </div>
                  </div>
                  <Button onClick={() => setStep('review')} disabled={rows.length === 0}>
                    Revisar Transacciones <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── STEP 2: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-3 text-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-700">{toImport.length}</p>
                  <p className="text-xs text-green-600">A importar</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-3 text-center">
                  <Ban className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-700">{discarded.length}</p>
                  <p className="text-xs text-red-600">Descartados</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="p-3 text-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-amber-700">{duplicates.length}</p>
                  <p className="text-xs text-amber-600">Duplicados</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total a importar</p>
                  <p className="text-xl font-bold">${toImport.reduce((s, r) => s + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            </div>

            {/* Transaction list */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                    <tr>
                      <th className="p-2 text-left w-8">✓</th>
                      <th className="p-2 text-left w-24">Fecha</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-right w-24">Monto</th>
                      <th className="p-2 text-left w-36">
                        <div className="flex items-center gap-1">
                          Categoría
                          <button onClick={() => setShowNewCat(v => !v)} className="text-primary hover:text-primary/80" title="Nueva categoría">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {showNewCat && (
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              value={newCatLabel}
                              onChange={e => setNewCatLabel(e.target.value)}
                              placeholder="Nombre..."
                              className="h-5 text-[10px] border rounded px-1 bg-background w-20"
                              onKeyDown={e => e.key === 'Enter' && saveNewCategory()}
                            />
                            <button onClick={saveNewCategory} disabled={savingCat} className="text-[10px] text-green-600 font-semibold">
                              {savingCat ? '...' : 'OK'}
                            </button>
                          </div>
                        )}
                      </th>
                      <th className="p-2 text-left w-36">Notas</th>
                      <th className="p-2 text-left w-44">Camión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className={`border-t ${row.discarded ? 'opacity-40 bg-muted/30' : row.isDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                        {/* Toggle discard */}
                        <td className="p-2">
                          <button
                            onClick={() => toggleDiscard(idx)}
                            className={`w-5 h-5 rounded border flex items-center justify-center ${row.discarded ? 'bg-red-100 border-red-400 text-red-600' : 'border-muted-foreground/30 hover:border-primary'}`}
                            title={row.discarded ? 'Recuperar' : 'Descartar'}
                          >
                            {row.discarded && <XCircle className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
                        <td className="p-2 max-w-[200px]">
                          <span className={`block truncate ${row.discarded ? 'line-through text-muted-foreground' : ''}`}>
                            {row.description}
                          </span>
                          {row.discardReason && (
                            <span className="text-[10px] text-red-500">{discardReasonLabel[row.discardReason]}</span>
                          )}
                          {row.isDuplicate && !row.discarded && (
                            <span className="text-[10px] text-amber-600 block">{row.duplicateNote}</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-semibold whitespace-nowrap">
                          ${row.amount.toFixed(2)}
                        </td>
                        {/* Category */}
                        <td className="p-2">
                          {!row.discarded && !row.isDuplicate && (
                            <select
                              value={row.category}
                              onChange={e => updateRow(idx, { category: e.target.value })}
                              className="w-full h-6 text-xs border rounded px-1 bg-background"
                            >
                              {allCategories.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* Notas */}
                        <td className="p-2">
                          {!row.discarded && !row.isDuplicate && (
                            <input
                              type="text"
                              value={row.notes}
                              onChange={e => updateRow(idx, { notes: e.target.value })}
                              placeholder="Nota..."
                              className="w-full h-6 text-xs border rounded px-1 bg-background"
                            />
                          )}
                        </td>
                        {/* Truck assignment */}
                        <td className="p-2">
                          {!row.discarded && !row.isDuplicate && (
                            <div className="space-y-1">
                              <select
                                value={row.assignMode === 'single' ? (row.truckId || '') : row.assignMode || ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  if (v === 'fleet') {
                                    updateRow(idx, { assignMode: 'fleet', truckId: null, fleetTruckIds: [] });
                                  } else if (v === '') {
                                    updateRow(idx, { assignMode: null, truckId: null });
                                  } else {
                                    updateRow(idx, { assignMode: 'single', truckId: v });
                                  }
                                }}
                                className="w-full h-6 text-xs border rounded px-1 bg-background"
                              >
                                <option value="">— Sin asignar —</option>
                                {companyTrucks.map(t => {
                                  const driver = drivers.find(d => d.truck_id === t.id);
                                  return <option key={t.id} value={t.id}>#{t.unit_number} {driver?.name || ''}</option>;
                                })}
                                <option value="fleet">General / Flota</option>
                              </select>
                              {/* Fleet split UI */}
                              {row.assignMode === 'fleet' && (
                                <div className="mt-1 space-y-1 p-1.5 bg-muted/50 rounded border">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[10px] text-muted-foreground">División:</span>
                                    <button
                                      onClick={() => updateRow(idx, { fleetSplit: 'equal' })}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${row.fleetSplit === 'equal' ? 'bg-primary text-primary-foreground' : 'border'}`}
                                    >Igual</button>
                                    <button
                                      onClick={() => updateRow(idx, { fleetSplit: 'custom' })}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${row.fleetSplit === 'custom' ? 'bg-primary text-primary-foreground' : 'border'}`}
                                    >Personalizado</button>
                                  </div>
                                  {companyTrucks.map(t => {
                                    const selected = row.fleetTruckIds.includes(t.id);
                                    const driver = drivers.find(d => d.truck_id === t.id);
                                    const equalAmt = row.fleetTruckIds.length > 0
                                      ? (row.amount / row.fleetTruckIds.length).toFixed(2) : '0.00';
                                    return (
                                      <div key={t.id} className="flex items-center gap-1">
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={checked => {
                                            const ids = checked
                                              ? [...row.fleetTruckIds, t.id]
                                              : row.fleetTruckIds.filter(id => id !== t.id);
                                            updateRow(idx, { fleetTruckIds: ids });
                                          }}
                                          className="h-3 w-3"
                                        />
                                        <span className="text-[10px] flex-1 truncate">#{t.unit_number} {driver?.name || ''}</span>
                                        {selected && row.fleetSplit === 'equal' && (
                                          <span className="text-[10px] text-muted-foreground">${equalAmt}</span>
                                        )}
                                        {selected && row.fleetSplit === 'custom' && (
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={row.customAmounts[t.id] || ''}
                                            onChange={e => updateRow(idx, {
                                              customAmounts: { ...row.customAmounts, [t.id]: parseFloat(e.target.value) || 0 }
                                            })}
                                            className="w-14 h-5 text-[10px] border rounded px-1 bg-background"
                                            placeholder="0.00"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={toImport.length === 0}>
                Confirmar importación <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Gastos a importar</p><p className="text-2xl font-bold">{toImport.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">${toImport.reduce((s,r)=>s+r.amount,0).toLocaleString('en-US',{minimumFractionDigits:2})}</p></div>
                <div><p className="text-xs text-muted-foreground">Descartados</p><p className="text-2xl font-bold text-muted-foreground">{discarded.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Duplicados omitidos</p><p className="text-2xl font-bold text-amber-600">{duplicates.length}</p></div>
              </CardContent>
            </Card>

            {/* Category summary */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Resumen por categoría:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allCategories.filter(c => toImport.some(r => r.category === c.value)).map(c => {
                  const catRows = toImport.filter(r => r.category === c.value);
                  const total = catRows.reduce((s, r) => s + r.amount, 0);
                  return (
                    <div key={c.value} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground">{catRows.length} × ${total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('review')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Revisar
              </Button>
              <Button onClick={handleImport} disabled={importing} className="bg-green-600 hover:bg-green-700 gap-2">
                {importing ? 'Importando...' : `✓ Importar ${toImport.length} gastos`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, FileText, Download } from 'lucide-react';
import type { DbLoad, CreateLoadInput } from '@/hooks/useLoads';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (inputs: CreateLoadInput[]) => Promise<{ success: number; errors: number }>;
  drivers: { id: string; name: string }[];
  trucks: { id: string; unit_number: string; license_plate: string | null }[];
  dispatchers: { id: string; name: string }[];
  existingLoads: DbLoad[];
}

// All mappable fields
const LOAD_FIELDS = [
  { key: 'reference_number', label: 'Reference Number', required: true },
  { key: 'origin', label: 'Origin', required: true },
  { key: 'destination', label: 'Destination', required: true },
  { key: 'total_rate', label: 'Total Rate', required: true },
  { key: 'pickup_date', label: 'Pickup Date', required: false },
  { key: 'delivery_date', label: 'Delivery Date', required: false },
  { key: 'miles', label: 'Miles', required: false },
  { key: 'weight', label: 'Weight', required: false },
  { key: 'broker_client', label: 'Broker/Client', required: false },
  { key: 'driver_name', label: 'Driver (name)', required: false },
  { key: 'truck_unit', label: 'Truck (unit #)', required: false },
  { key: 'dispatcher_name', label: 'Dispatcher (name)', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'cargo_type', label: 'Cargo Type', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'driver_pay_amount', label: 'Driver Pay', required: false },
  { key: 'dispatcher_pay_amount', label: 'Dispatcher Pay', required: false },
  { key: 'investor_pay_amount', label: 'Investor Pay', required: false },
  { key: 'company_profit', label: 'Company Profit', required: false },
  { key: 'factoring', label: 'Factoring', required: false },
] as const;

type FieldKey = typeof LOAD_FIELDS[number]['key'];

interface ValidatedRow {
  rowNum: number;
  mapped: Record<string, string>;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
  skip: boolean;
  loadInput: CreateLoadInput | null;
  driverId: string | null;
  truckId: string | null;
  dispatcherId: string | null;
}

type Step = 'upload' | 'map' | 'validate' | 'confirm';

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(firstLine: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // MM/DD/YYYY
  const slashParts = raw.split('/');
  if (slashParts.length === 3) {
    const [m, d, y] = slashParts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  // YYYY-MM-DD or ISO
  const isoDate = new Date(raw);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString().split('T')[0];
  return null;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function LoadImportWizard({ open, onOpenChange, onImport, drivers, trucks, dispatchers, existingLoads }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [delimiter, setDelimiter] = useState(',');
  const [columnMap, setColumnMap] = useState<Record<FieldKey, number | -1>>({} as any);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMap({} as any);
    setValidatedRows([]);
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
  };

  const handleFileSelect = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;

      const delim = detectDelimiter(lines[0]);
      setDelimiter(delim);

      const hdrs = parseCsvLine(lines[0], delim).map(h => h.replace(/^"|"$/g, ''));
      setHeaders(hdrs);

      // Auto-detect columns
      const autoMap: Record<string, number> = {};
      hdrs.forEach((h, i) => {
        const hl = h.toLowerCase();
        if (/ref|reference|load\s*#|load\s*number/i.test(hl)) autoMap['reference_number'] = i;
        else if (/^origin$|pick\s*up\s*city|from/i.test(hl)) autoMap['origin'] = i;
        else if (/^dest|delivery\s*city|to$/i.test(hl)) autoMap['destination'] = i;
        else if (/total\s*rate|rate|amount|revenue/i.test(hl)) autoMap['total_rate'] = i;
        else if (/pick\s*up\s*date|pickup/i.test(hl)) autoMap['pickup_date'] = i;
        else if (/delivery\s*date|deliver/i.test(hl)) autoMap['delivery_date'] = i;
        else if (/^miles$|distance/i.test(hl)) autoMap['miles'] = i;
        else if (/weight/i.test(hl)) autoMap['weight'] = i;
        else if (/broker|client|customer/i.test(hl)) autoMap['broker_client'] = i;
        else if (/driver/i.test(hl) && !/pay/i.test(hl)) autoMap['driver_name'] = i;
        else if (/truck|unit/i.test(hl)) autoMap['truck_unit'] = i;
        else if (/dispatch/i.test(hl) && !/pay/i.test(hl)) autoMap['dispatcher_name'] = i;
        else if (/^status$/i.test(hl)) autoMap['status'] = i;
        else if (/cargo|type/i.test(hl)) autoMap['cargo_type'] = i;
        else if (/notes|comment/i.test(hl)) autoMap['notes'] = i;
        else if (/driver\s*pay/i.test(hl)) autoMap['driver_pay_amount'] = i;
        else if (/dispatch.*pay/i.test(hl)) autoMap['dispatcher_pay_amount'] = i;
        else if (/investor\s*pay/i.test(hl)) autoMap['investor_pay_amount'] = i;
        else if (/profit|company\s*profit/i.test(hl)) autoMap['company_profit'] = i;
        else if (/factoring/i.test(hl)) autoMap['factoring'] = i;
      });
      setColumnMap(autoMap as any);

      const dataRows = lines.slice(1).map(l => parseCsvLine(l, delim));
      setRawRows(dataRows);
    };
    reader.readAsText(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) handleFileSelect(f);
  }, []);

  const getVal = (row: string[], field: FieldKey): string => {
    const idx = columnMap[field];
    if (idx === undefined || idx === -1 || idx >= row.length) return '';
    return row[idx] || '';
  };

  const runValidation = () => {
    const existingRefs = new Set(existingLoads.map(l => l.reference_number.toLowerCase().trim()));

    const validated: ValidatedRow[] = rawRows.map((row, i) => {
      const mapped: Record<string, string> = {};
      LOAD_FIELDS.forEach(f => { mapped[f.key] = getVal(row, f.key); });

      const messages: string[] = [];
      let status: 'valid' | 'warning' | 'error' = 'valid';

      // Required fields
      if (!mapped.reference_number) { status = 'error'; messages.push('Missing reference number'); }
      if (!mapped.origin) { status = 'error'; messages.push('Missing origin'); }
      if (!mapped.destination) { status = 'error'; messages.push('Missing destination'); }

      const rate = parseNumber(mapped.total_rate);
      if (rate === null || rate < 0) { status = 'error'; messages.push('Invalid rate'); }

      // Duplicate check
      if (mapped.reference_number && existingRefs.has(mapped.reference_number.toLowerCase().trim())) {
        if (status !== 'error') status = 'warning';
        messages.push('Duplicate reference number');
      }

      // Date validation
      if (mapped.pickup_date && !parseDate(mapped.pickup_date)) {
        if (status !== 'error') status = 'warning';
        messages.push(`Invalid pickup date: "${mapped.pickup_date}"`);
      }
      if (mapped.delivery_date && !parseDate(mapped.delivery_date)) {
        if (status !== 'error') status = 'warning';
        messages.push(`Invalid delivery date: "${mapped.delivery_date}"`);
      }

      // Driver matching
      let driverId: string | null = null;
      if (mapped.driver_name) {
        const match = drivers.find(d => d.name.toLowerCase().trim() === mapped.driver_name.toLowerCase().trim());
        if (match) {
          driverId = match.id;
        } else {
          if (status !== 'error') status = 'warning';
          messages.push(`Driver "${mapped.driver_name}" not found`);
        }
      }

      // Truck matching
      let truckId: string | null = null;
      if (mapped.truck_unit) {
        const unitVal = mapped.truck_unit.trim();
        const match = trucks.find(t =>
          t.unit_number.toLowerCase() === unitVal.toLowerCase() ||
          (t.license_plate && t.license_plate.toLowerCase() === unitVal.toLowerCase())
        );
        if (match) {
          truckId = match.id;
        } else {
          if (status !== 'error') status = 'warning';
          messages.push(`Truck "${unitVal}" not found`);
        }
      }

      // Dispatcher matching
      let dispatcherId: string | null = null;
      if (mapped.dispatcher_name) {
        const match = dispatchers.find(d => d.name.toLowerCase().trim() === mapped.dispatcher_name.toLowerCase().trim());
        if (match) {
          dispatcherId = match.id;
        } else {
          if (status !== 'error') status = 'warning';
          messages.push(`Dispatcher "${mapped.dispatcher_name}" not found`);
        }
      }

      if (messages.length === 0) messages.push('Ready to import');

      const loadInput: CreateLoadInput | null = status !== 'error' ? {
        reference_number: mapped.reference_number.trim(),
        origin: mapped.origin.trim(),
        destination: mapped.destination.trim(),
        total_rate: rate!,
        pickup_date: mapped.pickup_date ? parseDate(mapped.pickup_date) || undefined : undefined,
        delivery_date: mapped.delivery_date ? parseDate(mapped.delivery_date) || undefined : undefined,
        miles: mapped.miles ? parseNumber(mapped.miles) || undefined : undefined,
        weight: mapped.weight ? parseNumber(mapped.weight) || undefined : undefined,
        broker_client: mapped.broker_client || undefined,
        driver_id: driverId || undefined,
        truck_id: truckId || undefined,
        dispatcher_id: dispatcherId || undefined,
        cargo_type: mapped.cargo_type || undefined,
        notes: mapped.notes || undefined,
        driver_pay_amount: mapped.driver_pay_amount ? parseNumber(mapped.driver_pay_amount) || undefined : undefined,
        dispatcher_pay_amount: mapped.dispatcher_pay_amount ? parseNumber(mapped.dispatcher_pay_amount) || undefined : undefined,
        investor_pay_amount: mapped.investor_pay_amount ? parseNumber(mapped.investor_pay_amount) || undefined : undefined,
        company_profit: mapped.company_profit ? parseNumber(mapped.company_profit) || undefined : undefined,
        factoring: mapped.factoring || undefined,
      } : null;

      return { rowNum: i + 2, mapped, status, messages, skip: false, loadInput, driverId, truckId, dispatcherId };
    });

    setValidatedRows(validated);
  };

  const validCount = validatedRows.filter(r => r.status === 'valid').length;
  const warningCount = validatedRows.filter(r => r.status === 'warning').length;
  const errorCount = validatedRows.filter(r => r.status === 'error').length;

  const rowsToImport = validatedRows.filter(r => r.status !== 'error' && !r.skip && r.loadInput);
  const totalRate = rowsToImport.reduce((s, r) => s + (r.loadInput?.total_rate || 0), 0);

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    const inputs = rowsToImport.map(r => r.loadInput!);
    const batchSize = 50;
    let success = 0;
    let errors = 0;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const result = await onImport(batch);
      success += result.success;
      errors += result.errors;
      setImportProgress(Math.round(((i + batch.length) / inputs.length) * 100));
    }

    setImportResult({ success, errors });
    setImporting(false);
  };

  const downloadTemplate = () => {
    const templateHeaders = ['Reference Number', 'Origin', 'Destination', 'Total Rate', 'Pickup Date', 'Delivery Date', 'Miles', 'Weight', 'Broker/Client', 'Driver', 'Truck Unit', 'Status', 'Cargo Type', 'Notes', 'Driver Pay', 'Dispatcher Pay', 'Investor Pay'];
    const sampleRow = ['LD-001', 'Miami, FL', 'Atlanta, GA', '2500', '01/15/2025', '01/16/2025', '660', '20000', 'ABC Logistics', 'John Doe', '101', 'delivered', 'Dry Van', '', '750', '200', '375'];
    const csv = [templateHeaders.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loads_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredMapped = columnMap['reference_number'] !== undefined && columnMap['reference_number'] !== -1 &&
    columnMap['origin'] !== undefined && columnMap['origin'] !== -1 &&
    columnMap['destination'] !== undefined && columnMap['destination'] !== -1 &&
    columnMap['total_rate'] !== undefined && columnMap['total_rate'] !== -1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Loads from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-4">
          {(['upload', 'map', 'validate', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-2 rounded-full ${(['upload', 'map', 'validate', 'confirm'].indexOf(step) >= i) ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>1. Upload</span><span>2. Map Columns</span><span>3. Validate</span><span>4. Import</span>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('load-csv-upload')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">Accepted: .csv — Supports comma, semicolon, and tab delimiters</p>
              <input id="load-csv-upload" type="file" accept=".csv,.txt" className="hidden"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </div>

            {file && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB · {rawRows.length} rows detected · {headers.length} columns
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => { setFile(null); setRawRows([]); setHeaders([]); }} variant="ghost" size="sm">Remove</Button>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> Download Template
              </Button>
              <Button onClick={() => setStep('map')} disabled={!file || rawRows.length === 0}>
                Next — Map Columns <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Map your CSV columns to load fields. Fields marked with * are required.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {LOAD_FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                  <Select
                    value={columnMap[f.key] !== undefined ? String(columnMap[f.key]) : '-1'}
                    onValueChange={v => setColumnMap(prev => ({ ...prev, [f.key]: Number(v) }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Skip —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">— Skip —</SelectItem>
                      {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            <div className="border rounded-lg overflow-auto max-h-40">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted">
                  {LOAD_FIELDS.filter(f => columnMap[f.key] !== undefined && columnMap[f.key] !== -1).slice(0, 6).map(f => (
                    <th key={f.key} className="p-2 text-left">{f.label}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rawRows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-t">
                      {LOAD_FIELDS.filter(f => columnMap[f.key] !== undefined && columnMap[f.key] !== -1).slice(0, 6).map(f => (
                        <td key={f.key} className="p-2">{r[columnMap[f.key]] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => { runValidation(); setStep('validate'); }} disabled={!requiredMapped}>
                Next — Validate Data <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Validate */}
        {step === 'validate' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{validCount}</p>
                  <p className="text-xs text-green-600">Valid</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{warningCount}</p>
                  <p className="text-xs text-amber-600">Warnings</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                  <p className="text-xs text-red-600">Errors</p>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-lg overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted sticky top-0">
                  <th className="p-2 w-8">Skip</th>
                  <th className="p-2 text-left w-12">Row</th>
                  <th className="p-2 text-left">Reference</th>
                  <th className="p-2 text-left">Origin</th>
                  <th className="p-2 text-left">Destination</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Messages</th>
                </tr></thead>
                <tbody>
                  {validatedRows.map((r, i) => (
                    <tr key={i} className={`border-t ${r.status === 'error' ? 'bg-red-50/50' : r.status === 'warning' ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-2 text-center">
                        {r.status !== 'error' && (
                          <Checkbox
                            checked={r.skip}
                            onCheckedChange={v => {
                              setValidatedRows(prev => prev.map((row, j) => j === i ? { ...row, skip: !!v } : row));
                            }}
                          />
                        )}
                      </td>
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2 font-medium">{r.mapped.reference_number}</td>
                      <td className="p-2">{r.mapped.origin?.substring(0, 20)}</td>
                      <td className="p-2">{r.mapped.destination?.substring(0, 20)}</td>
                      <td className="p-2 text-right">{r.loadInput ? `$${r.loadInput.total_rate.toLocaleString()}` : '—'}</td>
                      <td className="p-2">
                        {r.status === 'valid' && <Badge className="bg-green-100 text-green-800 text-[10px]">✓ Valid</Badge>}
                        {r.status === 'warning' && <Badge className="bg-amber-100 text-amber-800 text-[10px]">⚠ Warning</Badge>}
                        {r.status === 'error' && <Badge className="bg-red-100 text-red-800 text-[10px]">✗ Error</Badge>}
                      </td>
                      <td className="p-2 text-muted-foreground">{r.messages.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={rowsToImport.length === 0}>
                Next — Confirm Import ({rowsToImport.length} rows) <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Import */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {!importResult ? (
              <>
                <Card>
                  <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Loads to Import</p><p className="text-2xl font-bold">{rowsToImport.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">${totalRate.toLocaleString()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Skipped</p><p className="text-2xl font-bold text-muted-foreground">{validatedRows.length - rowsToImport.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Drivers Matched</p><p className="text-2xl font-bold">{new Set(rowsToImport.filter(r => r.driverId).map(r => r.driverId)).size}</p></div>
                  </CardContent>
                </Card>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={importProgress} className="h-3" />
                    <p className="text-sm text-center text-muted-foreground">Importing... {importProgress}%</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('validate')} disabled={importing}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleImport} disabled={importing} className="bg-green-600 hover:bg-green-700">
                    {importing ? 'Importing...' : `Import ${rowsToImport.length} Loads`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4 py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                <h3 className="text-xl font-bold">Import Complete!</h3>
                <p className="text-muted-foreground">
                  {importResult.success} loads imported successfully.
                  {importResult.errors > 0 && ` ${importResult.errors} failed.`}
                </p>
                <Button onClick={() => { reset(); onOpenChange(false); }}>
                  Close
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

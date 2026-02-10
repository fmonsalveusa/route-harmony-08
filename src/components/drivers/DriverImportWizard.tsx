import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, FileText, Download } from 'lucide-react';
import type { DriverInput } from '@/hooks/useDrivers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (inputs: DriverInput[]) => Promise<{ success: number; errors: number }>;
  existingDrivers: { id: string; email: string; license: string }[];
  trucks: { id: string; unit_number: string }[];
  dispatchers: { id: string; name: string }[];
}

const DRIVER_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'license', label: 'License', required: true },
  { key: 'license_expiry', label: 'License Expiry', required: false },
  { key: 'medical_card_expiry', label: 'Medical Card Expiry', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'service_type', label: 'Service Type', required: false },
  { key: 'dispatcher_name', label: 'Dispatcher (name)', required: false },
  { key: 'truck_unit', label: 'Truck (unit #)', required: false },
  { key: 'investor_name', label: 'Investor Name', required: false },
  { key: 'pay_percentage', label: 'Pay Percentage', required: false },
  { key: 'investor_pay_percentage', label: 'Investor Pay %', required: false },
  { key: 'factoring_percentage', label: 'Factoring %', required: false },
  { key: 'hire_date', label: 'Hire Date', required: false },
] as const;

type FieldKey = typeof DRIVER_FIELDS[number]['key'];

interface ValidatedRow {
  rowNum: number;
  mapped: Record<string, string>;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
  skip: boolean;
  driverInput: DriverInput | null;
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
  const slashParts = raw.split('/');
  if (slashParts.length === 3) {
    const [m, d, y] = slashParts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const isoDate = new Date(raw);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString().split('T')[0];
  return null;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s%]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_STATUSES = ['available', 'assigned', 'resting', 'inactive', 'pending'];
const VALID_SERVICE_TYPES = ['owner_operator', 'company_driver', 'dispatch_service'];

export function DriverImportWizard({ open, onOpenChange, onImport, existingDrivers, trucks, dispatchers }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
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

      const hdrs = parseCsvLine(lines[0], delim).map(h => h.replace(/^"|"$/g, ''));
      setHeaders(hdrs);

      const autoMap: Record<string, number> = {};
      hdrs.forEach((h, i) => {
        const hl = h.toLowerCase().trim();
        if (/^name$|driver\s*name|full\s*name/i.test(hl)) autoMap['name'] = i;
        else if (/^email$|e-?mail/i.test(hl)) autoMap['email'] = i;
        else if (/^phone$|phone\s*number|tel/i.test(hl)) autoMap['phone'] = i;
        else if (/^license$|license\s*number|cdl/i.test(hl)) autoMap['license'] = i;
        else if (/license\s*exp/i.test(hl)) autoMap['license_expiry'] = i;
        else if (/medical/i.test(hl)) autoMap['medical_card_expiry'] = i;
        else if (/^status$/i.test(hl)) autoMap['status'] = i;
        else if (/service\s*type/i.test(hl)) autoMap['service_type'] = i;
        else if (/dispatch/i.test(hl)) autoMap['dispatcher_name'] = i;
        else if (/truck|unit/i.test(hl)) autoMap['truck_unit'] = i;
        else if (/investor/i.test(hl) && !/pay|percent/i.test(hl)) autoMap['investor_name'] = i;
        else if (/^pay\s*%|pay\s*percent|driver\s*pay\s*%/i.test(hl)) autoMap['pay_percentage'] = i;
        else if (/investor\s*pay\s*%|investor\s*percent/i.test(hl)) autoMap['investor_pay_percentage'] = i;
        else if (/factoring/i.test(hl)) autoMap['factoring_percentage'] = i;
        else if (/hire\s*date|start\s*date/i.test(hl)) autoMap['hire_date'] = i;
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
    const existingEmails = new Set(existingDrivers.map(d => d.email.toLowerCase().trim()));
    const existingLicenses = new Set(existingDrivers.map(d => d.license.toLowerCase().trim()));

    const validated: ValidatedRow[] = rawRows.map((row, i) => {
      const mapped: Record<string, string> = {};
      DRIVER_FIELDS.forEach(f => { mapped[f.key] = getVal(row, f.key); });

      const messages: string[] = [];
      let status: 'valid' | 'warning' | 'error' = 'valid';

      // Required fields
      if (!mapped.name?.trim()) { status = 'error'; messages.push('Missing name'); }
      if (!mapped.email?.trim()) { status = 'error'; messages.push('Missing email'); }
      else if (!EMAIL_RE.test(mapped.email.trim())) { status = 'error'; messages.push('Invalid email format'); }
      if (!mapped.phone?.trim()) { status = 'error'; messages.push('Missing phone'); }
      if (!mapped.license?.trim()) { status = 'error'; messages.push('Missing license'); }

      // Duplicates
      if (mapped.email && existingEmails.has(mapped.email.toLowerCase().trim())) {
        status = 'error'; messages.push('Duplicate email (already exists)');
      }
      if (mapped.license && existingLicenses.has(mapped.license.toLowerCase().trim())) {
        status = 'error'; messages.push('Duplicate license (already exists)');
      }

      // Date validations
      if (mapped.license_expiry && !parseDate(mapped.license_expiry)) {
        if (status !== 'error') status = 'warning';
        messages.push(`Invalid license expiry date`);
      }
      if (mapped.medical_card_expiry && !parseDate(mapped.medical_card_expiry)) {
        if (status !== 'error') status = 'warning';
        messages.push(`Invalid medical card expiry date`);
      }
      if (mapped.hire_date && !parseDate(mapped.hire_date)) {
        if (status !== 'error') status = 'warning';
        messages.push(`Invalid hire date`);
      }

      // Percentage validations
      for (const pctField of ['pay_percentage', 'investor_pay_percentage', 'factoring_percentage'] as const) {
        if (mapped[pctField]) {
          const pct = parseNumber(mapped[pctField]);
          if (pct === null || pct < 0 || pct > 100) {
            if (status !== 'error') status = 'warning';
            messages.push(`Invalid ${pctField.replace(/_/g, ' ')}`);
          }
        }
      }

      // Dispatcher matching
      let dispatcherId: string | null = null;
      if (mapped.dispatcher_name?.trim()) {
        const match = dispatchers.find(d => d.name.toLowerCase().trim() === mapped.dispatcher_name.toLowerCase().trim());
        if (match) {
          dispatcherId = match.id;
        } else {
          if (status !== 'error') status = 'warning';
          messages.push(`Dispatcher "${mapped.dispatcher_name}" not found`);
        }
      }

      // Truck matching
      let truckId: string | null = null;
      if (mapped.truck_unit?.trim()) {
        const match = trucks.find(t => t.unit_number.toLowerCase().trim() === mapped.truck_unit.toLowerCase().trim());
        if (match) {
          truckId = match.id;
        } else {
          if (status !== 'error') status = 'warning';
          messages.push(`Truck "${mapped.truck_unit}" not found`);
        }
      }

      if (messages.length === 0) messages.push('Ready to import');

      // Normalize service_type
      let serviceType = 'owner_operator';
      if (mapped.service_type?.trim()) {
        const st = mapped.service_type.toLowerCase().trim().replace(/\s+/g, '_');
        if (VALID_SERVICE_TYPES.includes(st)) serviceType = st;
      }

      let driverStatus = 'available';
      if (mapped.status?.trim()) {
        const s = mapped.status.toLowerCase().trim();
        if (VALID_STATUSES.includes(s)) driverStatus = s;
      }

      const driverInput: DriverInput | null = status !== 'error' ? {
        name: mapped.name.trim(),
        email: mapped.email.trim(),
        phone: mapped.phone.trim(),
        license: mapped.license.trim(),
        license_expiry: mapped.license_expiry ? parseDate(mapped.license_expiry) : null,
        medical_card_expiry: mapped.medical_card_expiry ? parseDate(mapped.medical_card_expiry) : null,
        status: driverStatus,
        service_type: serviceType,
        dispatcher_id: dispatcherId,
        truck_id: truckId,
        investor_name: mapped.investor_name?.trim() || null,
        pay_percentage: mapped.pay_percentage ? (parseNumber(mapped.pay_percentage) ?? 0) : 0,
        investor_pay_percentage: mapped.investor_pay_percentage ? (parseNumber(mapped.investor_pay_percentage) ?? null) : null,
        factoring_percentage: mapped.factoring_percentage ? (parseNumber(mapped.factoring_percentage) ?? 0) : 0,
        hire_date: mapped.hire_date ? (parseDate(mapped.hire_date) || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      } : null;

      return { rowNum: i + 2, mapped, status, messages, skip: false, driverInput };
    });

    setValidatedRows(validated);
  };

  const validCount = validatedRows.filter(r => r.status === 'valid').length;
  const warningCount = validatedRows.filter(r => r.status === 'warning').length;
  const errorCount = validatedRows.filter(r => r.status === 'error').length;

  const rowsToImport = validatedRows.filter(r => r.status !== 'error' && !r.skip && r.driverInput);

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    const inputs = rowsToImport.map(r => r.driverInput!);
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
    const templateHeaders = ['Name', 'Email', 'Phone', 'License', 'License Expiry', 'Medical Card Expiry', 'Status', 'Service Type', 'Dispatcher', 'Truck Unit', 'Investor Name', 'Pay Percentage', 'Investor Pay %', 'Factoring %', 'Hire Date'];
    const sampleRow = ['John Doe', 'john@example.com', '555-123-4567', 'CDL12345', '12/31/2025', '06/30/2025', 'available', 'owner_operator', 'Jane Smith', '101', 'Investor Inc', '70', '10', '5', '01/15/2024'];
    const csv = [templateHeaders.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drivers_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredMapped = columnMap['name'] !== undefined && columnMap['name'] !== -1 &&
    columnMap['email'] !== undefined && columnMap['email'] !== -1 &&
    columnMap['phone'] !== undefined && columnMap['phone'] !== -1 &&
    columnMap['license'] !== undefined && columnMap['license'] !== -1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Drivers from CSV
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
              onClick={() => document.getElementById('driver-csv-upload')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">Accepted: .csv — Supports comma, semicolon, and tab delimiters</p>
              <input id="driver-csv-upload" type="file" accept=".csv,.txt" className="hidden"
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
            <p className="text-sm text-muted-foreground">Map your CSV columns to driver fields. Fields marked with * are required.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {DRIVER_FIELDS.map(f => (
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
                  {DRIVER_FIELDS.filter(f => columnMap[f.key] !== undefined && columnMap[f.key] !== -1).slice(0, 6).map(f => (
                    <th key={f.key} className="p-2 text-left">{f.label}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rawRows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-t">
                      {DRIVER_FIELDS.filter(f => columnMap[f.key] !== undefined && columnMap[f.key] !== -1).slice(0, 6).map(f => (
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
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">License</th>
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
                      <td className="p-2 font-medium">{r.mapped.name}</td>
                      <td className="p-2">{r.mapped.email}</td>
                      <td className="p-2">{r.mapped.phone}</td>
                      <td className="p-2">{r.mapped.license}</td>
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
                  <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><p className="text-xs text-muted-foreground">Drivers to Import</p><p className="text-2xl font-bold">{rowsToImport.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Skipped</p><p className="text-2xl font-bold text-muted-foreground">{validatedRows.length - rowsToImport.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">With Truck Assigned</p><p className="text-2xl font-bold">{rowsToImport.filter(r => r.driverInput?.truck_id).length}</p></div>
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
                    {importing ? 'Importing...' : `Import ${rowsToImport.length} Drivers`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4 py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                <h3 className="text-xl font-bold">Import Complete!</h3>
                <p className="text-muted-foreground">
                  {importResult.success} drivers imported successfully.
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

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, FileText, Download } from 'lucide-react';
import type { DbTruck } from '@/hooks/useTrucks';
import type { CreateExpenseInput, DbExpense } from '@/hooks/useExpenses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (inputs: CreateExpenseInput[]) => Promise<boolean>;
  trucks: DbTruck[];
  drivers: { id: string; name: string; service_type: string; truck_id: string | null }[];
  existingExpenses: DbExpense[];
}

interface CsvRow {
  date: string;
  unit: string;
  amount: number;
  rawLine: string;
}

interface ValidatedRow extends CsvRow {
  rowNum: number;
  status: 'valid' | 'warning' | 'error';
  message: string;
  matchedTruck: DbTruck | null;
  skip: boolean;
}

type Step = 'upload' | 'map' | 'validate' | 'configure';

export function FuelImportWizard({ open, onOpenChange, onImport, trucks, drivers, existingExpenses }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateCol, setDateCol] = useState(0);
  const [unitCol, setUnitCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [skipWarnings, setSkipWarnings] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fuelCategory, setFuelCategory] = useState('diesel');
  const [paymentMethod, setPaymentMethod] = useState('fleet_card');
  const [vendorName, setVendorName] = useState('Fleet Card Provider');
  const [importing, setImporting] = useState(false);
  const [unitMapping, setUnitMapping] = useState<Record<string, string>>({});

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setValidatedRows([]);
    setUnitMapping({});
  };

  const handleFileSelect = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      setHeaders(hdrs);
      // Auto-detect columns
      const dateCandidates = hdrs.findIndex(h => /date/i.test(h));
      const unitCandidates = hdrs.findIndex(h => /unit/i.test(h));
      const amountCandidates = hdrs.findIndex(h => /total|amount|due|cost|price/i.test(h));
      if (dateCandidates >= 0) setDateCol(dateCandidates);
      if (unitCandidates >= 0) setUnitCol(unitCandidates);
      if (amountCandidates >= 0) setAmountCol(amountCandidates);

      const dataRows = lines.slice(1).map(l => {
        // Simple CSV parsing (handles quoted values)
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const ch of l) {
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        result.push(current.trim());
        return result;
      });
      setRawRows(dataRows);
    };
    reader.readAsText(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleFileSelect(f);
  }, []);

  const parseDate = (raw: string): string | null => {
    // Try MM/DD/YYYY
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }
    // Try YYYY-MM-DD
    const isoDate = new Date(raw);
    if (!isNaN(isoDate.getTime())) return isoDate.toISOString().split('T')[0];
    return null;
  };

  const parseAmount = (raw: string): number | null => {
    const cleaned = raw.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const runValidation = () => {
    const today = new Date().toISOString().split('T')[0];
    const validated: ValidatedRow[] = rawRows.map((row, i) => {
      const rawDate = row[dateCol] || '';
      const rawUnit = row[unitCol] || '';
      const rawAmount = row[amountCol] || '';

      const parsedDate = parseDate(rawDate);
      const parsedAmount = parseAmount(rawAmount);

      // Find truck by unit_number
      const mappedTruckId = unitMapping[rawUnit];
      let matchedTruck = mappedTruckId
        ? trucks.find(t => t.id === mappedTruckId) || null
        : trucks.find(t => t.unit_number === rawUnit) || null;

      // Determine status
      let status: 'valid' | 'warning' | 'error' = 'valid';
      let message = 'Ready to import';

      if (!parsedDate) {
        status = 'error';
        message = `Invalid date: "${rawDate}"`;
      } else if (parsedDate > today) {
        status = 'error';
        message = 'Date is in the future';
      } else if (!parsedAmount || parsedAmount <= 0) {
        status = 'error';
        message = `Invalid amount: "${rawAmount}"`;
      } else if (parsedAmount > 10000) {
        status = 'warning';
        message = `Amount unusually high: $${parsedAmount.toFixed(2)}`;
      } else if (!matchedTruck) {
        status = 'warning';
        message = `Unit "${rawUnit}" not found in system`;
      } else {
        // Duplicate detection
        const isDuplicate = existingExpenses.some(ex => {
          if (ex.truck_id !== matchedTruck!.id) return false;
          if (ex.expense_date !== parsedDate) return false;
          return Math.abs(ex.amount - parsedAmount!) <= 0.50;
        });
        if (isDuplicate) {
          status = 'warning';
          message = 'Possible duplicate (same date/truck/amount)';
        }
      }

      return {
        rowNum: i + 2,
        date: parsedDate || rawDate,
        unit: rawUnit,
        amount: parsedAmount || 0,
        rawLine: row.join(','),
        status,
        message,
        matchedTruck,
        skip: false,
      };
    });
    setValidatedRows(validated);
  };

  const validCount = validatedRows.filter(r => r.status === 'valid').length;
  const warningCount = validatedRows.filter(r => r.status === 'warning').length;
  const errorCount = validatedRows.filter(r => r.status === 'error').length;

  const rowsToImport = validatedRows.filter(r => {
    if (r.status === 'error') return false;
    if (r.skip) return false;
    if (r.status === 'warning' && skipWarnings) return false;
    return true;
  });

  const totalImportAmount = rowsToImport.reduce((s, r) => s + r.amount, 0);

  const handleImport = async () => {
    setImporting(true);
    const inputs: CreateExpenseInput[] = rowsToImport.map(r => ({
      expense_date: r.date,
      truck_id: r.matchedTruck?.id || null,
      driver_name: r.matchedTruck ? drivers.find(d => d.id === r.matchedTruck!.driver_id)?.name || null : null,
      driver_service_type: r.matchedTruck ? drivers.find(d => d.id === r.matchedTruck!.driver_id)?.service_type || null : null,
      expense_type: 'fuel',
      category: fuelCategory,
      description: 'Fuel purchase from fleet card',
      amount: r.amount,
      payment_method: paymentMethod,
      vendor: vendorName || null,
      source: 'csv_import',
    }));

    const success = await onImport(inputs);
    setImporting(false);
    if (success) {
      reset();
      onOpenChange(false);
    }
  };

  const downloadSkipped = () => {
    const skipped = validatedRows.filter(r => r.status !== 'valid' && (r.status === 'error' || (r.status === 'warning' && skipWarnings)));
    const csv = [headers.join(','), ...skipped.map(r => r.rawLine)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skipped_fuel_expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Fuel Expenses from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-4">
          {(['upload', 'map', 'validate', 'configure'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`h-2 flex-1 rounded-full ${
                (['upload', 'map', 'validate', 'configure'].indexOf(step) >= i) ? 'bg-primary' : 'bg-muted'
              }`} />
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
              onClick={() => document.getElementById('csv-upload')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">Accepted: .csv, Max 10MB</p>
              <input id="csv-upload" type="file" accept=".csv" className="hidden"
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
                        {(file.size / 1024).toFixed(1)} KB · {rawRows.length} transactions detected
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => { setFile(null); setRawRows([]); }} variant="ghost" size="sm">Remove</Button>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep('map')} disabled={!file || rawRows.length === 0}>
                Next - Map Columns <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Map your CSV columns to the required fields:</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date Column</Label>
                <Select value={String(dateCol)} onValueChange={v => setDateCol(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit Column</Label>
                <Select value={String(unitCol)} onValueChange={v => setUnitCol(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Column</Label>
                <Select value={String(amountCol)} onValueChange={v => setAmountCol(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg overflow-auto max-h-48">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted">
                  <th className="p-2 text-left">{headers[dateCol] || 'Date'}</th>
                  <th className="p-2 text-left">{headers[unitCol] || 'Unit'}</th>
                  <th className="p-2 text-right">{headers[amountCol] || 'Amount'}</th>
                </tr></thead>
                <tbody>
                  {rawRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r[dateCol]}</td>
                      <td className="p-2">{r[unitCol]}</td>
                      <td className="p-2 text-right">{r[amountCol]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => { runValidation(); setStep('validate'); }}>
                Next - Validate Data <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Validate */}
        {step === 'validate' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{validCount}</p>
                  <p className="text-xs text-green-600">Valid - Ready to import</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{warningCount}</p>
                  <p className="text-xs text-amber-600">Warnings - Can skip or fix</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                  <p className="text-xs text-red-600">Errors - Cannot import</p>
                </CardContent>
              </Card>
            </div>

            {/* Options */}
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Checkbox id="skip-warnings" checked={skipWarnings} onCheckedChange={v => setSkipWarnings(!!v)} />
                <label htmlFor="skip-warnings" className="text-sm">Skip rows with warnings</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="skip-dups" checked={skipDuplicates} onCheckedChange={v => setSkipDuplicates(!!v)} />
                <label htmlFor="skip-dups" className="text-sm">Skip duplicate expenses</label>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="border rounded-lg overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted sticky top-0">
                  <th className="p-2 text-left w-12">Row</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Unit</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Message</th>
                  <th className="p-2 text-left w-24">Action</th>
                </tr></thead>
                <tbody>
                  {validatedRows.map((r, i) => (
                    <tr key={i} className={`border-t ${r.status === 'error' ? 'bg-red-50/50' : r.status === 'warning' ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2">{r.date}</td>
                      <td className="p-2">{r.unit}</td>
                      <td className="p-2 text-right">${r.amount.toFixed(2)}</td>
                      <td className="p-2">
                        {r.status === 'valid' && <Badge className="bg-green-100 text-green-800">✓ Valid</Badge>}
                        {r.status === 'warning' && <Badge className="bg-amber-100 text-amber-800">⚠ Warning</Badge>}
                        {r.status === 'error' && <Badge className="bg-red-100 text-red-800">✗ Error</Badge>}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{r.message}</td>
                      <td className="p-2">
                        {r.status === 'warning' && r.message.includes('not found') && !r.matchedTruck && (
                          <Select value={unitMapping[r.unit] || ''} onValueChange={v => {
                            setUnitMapping(prev => ({ ...prev, [r.unit]: v }));
                          }}>
                            <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="Map" /></SelectTrigger>
                            <SelectContent>
                              {trucks.map(t => <SelectItem key={t.id} value={t.id}>#{t.unit_number}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Object.keys(unitMapping).length > 0 && (
              <Button variant="outline" size="sm" onClick={runValidation}>
                Re-validate with mapped units
              </Button>
            )}

            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('map')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                {(warningCount > 0 || errorCount > 0) && (
                  <Button variant="outline" size="sm" onClick={downloadSkipped}>
                    <Download className="h-4 w-4 mr-1" /> Download Skipped
                  </Button>
                )}
              </div>
              <Button onClick={() => setStep('configure')} disabled={rowsToImport.length === 0}>
                Next - Configure Import <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Configure & Import */}
        {step === 'configure' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Rows to Import</p><p className="text-xl font-bold">{rowsToImport.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Amount</p><p className="text-xl font-bold">${totalImportAmount.toFixed(2)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date Range</p><p className="text-sm font-medium">{rowsToImport.length > 0 ? `${rowsToImport[rowsToImport.length - 1].date} to ${rowsToImport[0].date}` : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Trucks Affected</p><p className="text-xl font-bold">{new Set(rowsToImport.filter(r => r.matchedTruck).map(r => r.matchedTruck!.id)).size}</p></div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-semibold mb-3">Import Configuration</h3>
              <p className="text-xs text-muted-foreground mb-3">All imported fuel expenses will be automatically configured with:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fuel Category</Label>
                  <Select value={fuelCategory} onValueChange={setFuelCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="def">DEF</SelectItem>
                      <SelectItem value="gasoline">Gasoline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fleet_card">Fleet Card</SelectItem>
                      <SelectItem value="credit_card">Company Credit Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g., WEX Fleet Card" />
                </div>
              </div>
            </div>

            {/* Preview card */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">SAMPLE EXPENSE PREVIEW</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> Fuel</div>
                  <div><span className="text-muted-foreground">Category:</span> {fuelCategory}</div>
                  <div><span className="text-muted-foreground">Payment:</span> {paymentMethod.replace('_', ' ')}</div>
                  <div><span className="text-muted-foreground">Vendor:</span> {vendorName || '—'}</div>
                  <div><span className="text-muted-foreground">Source:</span> CSV Import</div>
                  <div><span className="text-muted-foreground">Description:</span> Fuel purchase from fleet card</div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('validate')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleImport} disabled={importing} className="bg-green-600 hover:bg-green-700">
                {importing ? 'Importing...' : `Import ${rowsToImport.length} Expenses`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

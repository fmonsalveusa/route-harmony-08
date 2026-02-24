import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, X } from 'lucide-react';
import { todayET } from '@/lib/dateUtils';
import { DbDriver, DriverInput } from '@/hooks/useDrivers';
import { DbTruck } from '@/hooks/useTrucks';
import { DbDispatcher } from '@/hooks/useDispatchers';
import { toast } from 'sonner';
import { US_STATES } from '@/lib/usStates';

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: DbDriver | null;
  onSubmit: (data: DriverInput, files: Record<string, File | null>) => Promise<void>;
  trucks: DbTruck[];
  dispatchers: DbDispatcher[];
}

const emptyForm: DriverInput = {
  name: '', email: '', phone: '', license: '',
  license_expiry: null, medical_card_expiry: null,
  status: 'available', service_type: 'owner_operator',
  dispatcher_id: null, truck_id: null,
  investor_name: null, pay_percentage: 0, investor_pay_percentage: 0,
  factoring_percentage: 2,
  hire_date: todayET(),
  state: null,
};

type DocKey = 'license_photo' | 'medical_card_photo' | 'form_w9' | 'leasing_agreement' | 'service_agreement';

const docFields: { key: DocKey; label: string; urlKey: string }[] = [
  { key: 'license_photo', label: 'License Photo', urlKey: 'license_photo_url' },
  { key: 'medical_card_photo', label: 'Medical Card Photo', urlKey: 'medical_card_photo_url' },
  { key: 'form_w9', label: 'Form W9', urlKey: 'form_w9_url' },
  { key: 'leasing_agreement', label: 'Leasing Agreement', urlKey: 'leasing_agreement_url' },
  { key: 'service_agreement', label: 'Service Agreement', urlKey: 'service_agreement_url' },
];

export function DriverFormDialog({ open, onOpenChange, driver, onSubmit, trucks, dispatchers }: DriverFormDialogProps) {
  const [form, setForm] = useState<DriverInput>(emptyForm);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [deletedDocs, setDeletedDocs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (driver) {
      setForm({
        name: driver.name, email: driver.email, phone: driver.phone,
        license: driver.license, license_expiry: driver.license_expiry,
        medical_card_expiry: driver.medical_card_expiry, status: driver.status,
        service_type: driver.service_type, state: driver.state,
        dispatcher_id: driver.dispatcher_id, truck_id: driver.truck_id,
        investor_name: driver.investor_name, pay_percentage: driver.pay_percentage,
        investor_pay_percentage: driver.investor_pay_percentage,
        factoring_percentage: driver.factoring_percentage ?? 2,
        hire_date: driver.hire_date,
      });
    } else {
      setForm(emptyForm);
    }
    setFiles({});
    setDeletedDocs(new Set());
  }, [driver, open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('Name');
    if (!form.email.trim()) missing.push('Email');
    if (!form.phone.trim()) missing.push('Phone');
    if (!form.license.trim()) missing.push('Driver License #');
    if (missing.length > 0) {
      toast.error(`Required fields: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      // Build files with deleted docs set to null
      const finalFiles = { ...files };
      deletedDocs.forEach(urlKey => {
        const docField = docFields.find(d => d.urlKey === urlKey);
        if (docField && !finalFiles[docField.key]) {
          finalFiles[docField.key] = null;
        }
      });
      // Pass deleted doc URLs as null in form data
      const deletedUpdates: Record<string, null> = {};
      deletedDocs.forEach(urlKey => {
        const docField = docFields.find(d => d.urlKey === urlKey);
        if (docField && !files[docField.key]) {
          deletedUpdates[urlKey] = null;
        }
      });
      await onSubmit({ ...form, ...deletedUpdates } as any, finalFiles);
    } catch (err) {
      console.error('Error submitting driver:', err);
    } finally {
      setSaving(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{driver ? 'Edit Driver' : 'New Driver'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555-0000" />
          </div>
          <div className="space-y-2">
            <Label>Driver License # *</Label>
            <Input value={form.license} onChange={e => set('license', e.target.value)} placeholder="CDL-A-XXXXX" />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={form.state || 'none'} onValueChange={v => set('state', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <DatePickerField label="License Expiry" value={form.license_expiry} onChange={v => set('license_expiry', v)} />
          <DatePickerField label="Medical Card Expiry" value={form.medical_card_expiry} onChange={v => set('medical_card_expiry', v)} />

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="resting">Off Duty</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 p-3 rounded-lg border-2 border-amber-400/50 bg-amber-50">
            <Label className="font-semibold text-amber-700">Service Type ⭐</Label>
            <Select value={form.service_type} onValueChange={v => set('service_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner_operator">Owner Operator</SelectItem>
                <SelectItem value="company_driver">Company Driver</SelectItem>
                <SelectItem value="dispatch_service">Dispatch Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.service_type === 'dispatch_service' && (
            <div className="space-y-2 p-3 rounded-lg border-2 border-orange-400/50 bg-orange-50">
              <Label className="font-semibold text-orange-700">% Dispatch Service Fee ⭐</Label>
              <Input type="number" step="0.5" value={form.dispatch_service_percentage ?? 0} onChange={e => set('dispatch_service_percentage', Number(e.target.value))} placeholder="Ej: 10" />
              <p className="text-xs text-orange-600">Porcentaje que la empresa cobra al driver por el servicio de despacho</p>
            </div>
          )}

          <div className="space-y-2 p-3 rounded-lg border-2 border-emerald-400/50 bg-emerald-50">
            <Label className="font-semibold text-emerald-700">Assigned Dispatcher ⭐</Label>
            <Select value={form.dispatcher_id || 'none'} onValueChange={v => set('dispatcher_id', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {dispatchers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 p-3 rounded-lg border-2 border-sky-400/50 bg-sky-50">
            <Label className="font-semibold text-sky-700">Assigned Truck ⭐</Label>
            <Select value={form.truck_id || 'none'} onValueChange={v => set('truck_id', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {trucks.map(t => <SelectItem key={t.id} value={t.id}>Unit #{t.unit_number} · {t.truck_type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Investor Name</Label>
            <Input value={form.investor_name || ''} onChange={e => set('investor_name', e.target.value)} placeholder="Investor name" />
          </div>

          <div className="space-y-2">
            <Label>% Investor Pay</Label>
            <Input type="number" value={form.investor_pay_percentage ?? ''} onChange={e => set('investor_pay_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>% Driver Pay</Label>
            <Input type="number" value={form.pay_percentage} onChange={e => set('pay_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>% Factoring</Label>
            <Input type="number" step="0.5" value={form.factoring_percentage ?? 2} onChange={e => set('factoring_percentage', Number(e.target.value))} />
          </div>

          <DatePickerField label="Hire Date" value={form.hire_date} onChange={v => set('hire_date', v || todayET())} />
        </div>

        {/* Document uploads */}
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-sm">Documents</h3>
          {docFields.map(doc => {
            const existingUrl = driver ? (driver as any)[doc.urlKey] : null;
            const selectedFile = files[doc.key];
            const isDeleted = deletedDocs.has(doc.urlKey);
            const showExisting = existingUrl && !isDeleted;
            return (
              <div key={doc.key} className="flex items-center gap-3 p-3 border rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium min-w-[140px]">{doc.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  {selectedFile ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                      <button onClick={() => setFiles(prev => ({ ...prev, [doc.key]: null }))}><X className="h-3 w-3" /></button>
                    </div>
                  ) : showExisting ? (
                    <a href={existingUrl} target="_blank" rel="noopener" className="text-xs text-primary underline truncate max-w-[150px]">View file</a>
                  ) : (
                    <span className="text-xs text-muted-foreground">{isDeleted ? 'Marked for deletion' : 'No file'}</span>
                  )}
                </div>
                <input
                  ref={el => { fileRefs.current[doc.key] = el; }}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    setFiles(prev => ({ ...prev, [doc.key]: f }));
                    if (f) setDeletedDocs(prev => { const n = new Set(prev); n.delete(doc.urlKey); return n; });
                  }}
                />
                <div className="flex items-center gap-1">
                  {showExisting && !selectedFile && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-8 px-2" onClick={() => setDeletedDocs(prev => new Set(prev).add(doc.urlKey))}>
                      <X className="h-3.5 w-3.5 mr-0.5" /> Delete
                    </Button>
                  )}
                  {isDeleted && !selectedFile && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground h-8 px-2 text-xs" onClick={() => setDeletedDocs(prev => { const n = new Set(prev); n.delete(doc.urlKey); return n; })}>
                      Undo
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => fileRefs.current[doc.key]?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : driver ? 'Save Changes' : 'Create Driver'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} />
    </div>
  );
}

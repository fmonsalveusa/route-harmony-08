import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Upload, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DbTruck, TruckInput } from '@/hooks/useTrucks';
import { toast } from 'sonner';

const TRUCK_TYPES = ['Box Truck', 'Hotshot', 'Flatbed', 'Dry Van'];
const STATUSES = ['active', 'inactive', 'maintenance'];

const DOC_FIELDS: { key: string; label: string; urlKey: keyof DbTruck }[] = [
  { key: 'registration_photo', label: 'Registration Photo', urlKey: 'registration_photo_url' },
  { key: 'insurance_photo', label: 'Insurance Photo', urlKey: 'insurance_photo_url' },
  { key: 'license_photo', label: 'License Photo', urlKey: 'license_photo_url' },
  { key: 'rear_truck_photo', label: 'Rear Truck Photo', urlKey: 'rear_truck_photo_url' },
  { key: 'truck_side_photo', label: 'Truck Side Photo', urlKey: 'truck_side_photo_url' },
  { key: 'truck_plate_photo', label: 'Truck Plate Photo', urlKey: 'truck_plate_photo_url' },
  { key: 'cargo_area_photo', label: 'Cargo Area Photo', urlKey: 'cargo_area_photo_url' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  truck?: DbTruck | null;
  onSave: (input: TruckInput, files: Record<string, File>) => Promise<boolean>;
}

export function TruckFormDialog({ open, onOpenChange, truck, onSave }: Props) {
  const [form, setForm] = useState<TruckInput>({
    unit_number: '', truck_type: 'Dry Van', make: '', model: '', year: new Date().getFullYear(),
    max_payload_lbs: null, vin: '', license_plate: '', status: 'active',
    insurance_expiry: null, registration_expiry: null,
    cargo_length_ft: null, cargo_width_in: null, cargo_height_in: null,
    rear_door_width_in: null, rear_door_height_in: null,
    trailer_length_ft: null, mega_ramp: null,
  });
  const [files, setFiles] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFiles({});
      if (truck) {
        setForm({
          unit_number: truck.unit_number, truck_type: truck.truck_type, make: truck.make || '',
          model: truck.model || '', year: truck.year || new Date().getFullYear(),
          max_payload_lbs: truck.max_payload_lbs, vin: truck.vin || '',
          license_plate: truck.license_plate || '', status: truck.status,
          insurance_expiry: truck.insurance_expiry, registration_expiry: truck.registration_expiry,
          cargo_length_ft: truck.cargo_length_ft, cargo_width_in: truck.cargo_width_in,
          cargo_height_in: truck.cargo_height_in, rear_door_width_in: truck.rear_door_width_in,
          rear_door_height_in: truck.rear_door_height_in,
          trailer_length_ft: truck.trailer_length_ft, mega_ramp: truck.mega_ramp,
        });
      } else {
        setForm({
          unit_number: '', truck_type: 'Dry Van', make: '', model: '', year: new Date().getFullYear(),
          max_payload_lbs: null, vin: '', license_plate: '', status: 'active',
          insurance_expiry: null, registration_expiry: null,
          cargo_length_ft: null, cargo_width_in: null, cargo_height_in: null,
          rear_door_width_in: null, rear_door_height_in: null,
          trailer_length_ft: null, mega_ramp: null,
        });
      }
    }
  }, [open, truck]);

  const set = (key: keyof TruckInput, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.unit_number.trim()) {
      toast.error('Campo requerido: Unit #');
      return;
    }
    setSaving(true);
    const ok = await onSave(form, files);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{truck ? 'Editar Camión' : 'Nuevo Camión'}</DialogTitle>
          <DialogDescription>Completa la información del camión</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Unit #</Label>
            <Input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} placeholder="Ej: 101" />
          </div>
          <div className="space-y-2">
            <Label>Truck Type</Label>
            <Select value={form.truck_type} onValueChange={v => set('truck_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRUCK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Make</Label>
            <Input value={form.make || ''} onChange={e => set('make', e.target.value)} placeholder="Ej: Freightliner" />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={form.model || ''} onChange={e => set('model', e.target.value)} placeholder="Ej: Cascadia" />
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Input type="number" value={form.year || ''} onChange={e => set('year', e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div className="space-y-2">
            <Label>Max Payload (lbs)</Label>
            <Input type="number" value={form.max_payload_lbs ?? ''} onChange={e => set('max_payload_lbs', e.target.value ? parseFloat(e.target.value) : null)} />
          </div>
          <div className="space-y-2">
            <Label>VIN</Label>
            <Input value={form.vin || ''} onChange={e => set('vin', e.target.value)} placeholder="Vehicle Identification Number" />
          </div>
          <div className="space-y-2">
            <Label>License Plate</Label>
            <Input value={form.license_plate || ''} onChange={e => set('license_plate', e.target.value)} placeholder="Ej: TX-4521" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DateField label="Insurance Expiry" value={form.insurance_expiry} onChange={v => set('insurance_expiry', v)} />
          <DateField label="Registration Expiry" value={form.registration_expiry} onChange={v => set('registration_expiry', v)} />
        </div>

        {/* Box Truck dimensions */}
        {form.truck_type === 'Box Truck' && (
          <div className="border-t pt-4 space-y-2">
            <Label className="text-base font-semibold">Dimensiones Box Truck</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cargo Length (ft)</Label>
                <Input type="number" value={form.cargo_length_ft ?? ''} onChange={e => set('cargo_length_ft', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo Width (in)</Label>
                <Input type="number" value={form.cargo_width_in ?? ''} onChange={e => set('cargo_width_in', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo Height (in)</Label>
                <Input type="number" value={form.cargo_height_in ?? ''} onChange={e => set('cargo_height_in', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rear Door Width (in)</Label>
                <Input type="number" value={form.rear_door_width_in ?? ''} onChange={e => set('rear_door_width_in', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rear Door Height (in)</Label>
                <Input type="number" value={form.rear_door_height_in ?? ''} onChange={e => set('rear_door_height_in', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
            </div>
          </div>
        )}

        {/* Hotshot dimensions */}
        {form.truck_type === 'Hotshot' && (
          <div className="border-t pt-4 space-y-2">
            <Label className="text-base font-semibold">Dimensiones Hotshot</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Trailer Length (ft)</Label>
                <Input type="number" value={form.trailer_length_ft ?? ''} onChange={e => set('trailer_length_ft', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mega Ramp</Label>
                <Select value={form.mega_ramp || ''} onValueChange={v => set('mega_ramp', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="SI">SI</SelectItem>
                    <SelectItem value="NO">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Document uploads */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Documentos y Fotos</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOC_FIELDS.map(doc => (
              <FileUploadField
                key={doc.key}
                label={doc.label}
                existingUrl={truck?.[doc.urlKey] as string | null}
                file={files[doc.key]}
                onFileChange={f => setFiles(prev => ({ ...prev, [doc.key]: f }))}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.unit_number.trim()}>
            {saving ? 'Guardando...' : truck ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'MM/dd/yyyy') : 'Seleccionar fecha'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FileUploadField({ label, existingUrl, file, onFileChange }: {
  label: string; existingUrl: string | null | undefined; file?: File; onFileChange: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hasFile = !!file || !!existingUrl;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }} />
      <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => ref.current?.click()}>
        {hasFile ? <FileCheck className="h-3.5 w-3.5 text-primary" /> : <Upload className="h-3.5 w-3.5" />}
        {file ? file.name : existingUrl ? 'Documento cargado ✓' : 'Cargar archivo'}
      </Button>
    </div>
  );
}

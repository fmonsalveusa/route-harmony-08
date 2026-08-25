import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, User, Truck as TruckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import type { DispatchDriverEntry } from './DispatchServiceOnboarding';

const TRUCK_TYPES = ['Box Truck', 'Hotshot', 'Flatbed', 'Dry Van'];

interface Props {
  entry: DispatchDriverEntry;
  onChange: (updates: Partial<DispatchDriverEntry>) => void;
  onFileChange: (key: keyof DispatchDriverEntry, file: File | undefined) => void;
  ownerFullName?: string;
  showOwnerCheckbox?: boolean;
}

function FileUploadBox({ label, file, onChange, accept = 'image/*,.pdf' }: {
  label: string; file?: File; onChange: (f: File | undefined) => void; accept?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className={cn(
        'border-2 border-dashed rounded-lg p-2 text-center transition-colors',
        file ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/40'
      )}>
        {file ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] truncate flex-1">{file.name}</span>
            <button type="button" onClick={() => onChange(undefined)} className="text-[10px] text-destructive hover:underline">
              Remover
            </button>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-0.5 py-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Subir</span>
            <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );
}

export function DispatchDriverTruckForm({ entry, onChange, onFileChange, ownerFullName, showOwnerCheckbox }: Props) {
  const updateTruck = (field: keyof DispatchDriverEntry['truck'], value: any) => {
    onChange({ truck: { ...entry.truck, [field]: value } });
  };

  return (
    <div className="space-y-5">
      {/* Owner es el driver? */}
      {showOwnerCheckbox && ownerFullName && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
          <Checkbox
            id="is-owner"
            checked={!!entry.is_owner}
            onCheckedChange={(v) => {
              const isOwner = !!v;
              if (isOwner) {
                // Copiar nombre del owner
                onChange({ is_owner: true, name: ownerFullName });
              } else {
                onChange({ is_owner: false });
              }
            }}
          />
          <label htmlFor="is-owner" className="text-sm cursor-pointer">
            <span className="font-medium">El owner ({ownerFullName}) también es este driver</span>
            <span className="block text-xs text-muted-foreground">Marcar si el dueño de la empresa maneja este camión.</span>
          </label>
        </div>
      )}

      {/* Driver Info */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
          <User className="h-4 w-4 text-primary" /> Driver Info
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-xs">Full Name *</Label><Input value={entry.name} onChange={e => onChange({ name: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" value={entry.email} onChange={e => onChange({ email: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Phone *</Label><Input value={entry.phone} onChange={e => onChange({ phone: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Birthday</Label><Input type="date" value={entry.birthday || ''} onChange={e => onChange({ birthday: e.target.value || null })} /></div>
          <div className="space-y-1"><Label className="text-xs">Driver License # *</Label><Input value={entry.license} onChange={e => onChange({ license: e.target.value })} /></div>
          <div className="space-y-1">
            <Label className="text-xs">License State</Label>
            <Select value={entry.state || ''} onValueChange={v => onChange({ state: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">License Expiry *</Label><Input type="date" value={entry.license_expiry || ''} onChange={e => onChange({ license_expiry: e.target.value || null })} /></div>
          <div className="space-y-1"><Label className="text-xs">Medical Card Expiry *</Label><Input type="date" value={entry.medical_card_expiry || ''} onChange={e => onChange({ medical_card_expiry: e.target.value || null })} /></div>
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Address</Label><Input value={entry.address} onChange={e => onChange({ address: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">City</Label><Input value={entry.city} onChange={e => onChange({ city: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Zip</Label><Input value={entry.zip} onChange={e => onChange({ zip: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Emergency Contact Name</Label><Input value={entry.emergency_contact_name} onChange={e => onChange({ emergency_contact_name: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Emergency Contact Phone</Label><Input value={entry.emergency_phone} onChange={e => onChange({ emergency_phone: e.target.value })} /></div>
        </div>
      </div>

      {/* Truck Info */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
          <TruckIcon className="h-4 w-4 text-primary" /> Truck Info
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-xs">Unit # *</Label><Input value={entry.truck.unit_number} onChange={e => updateTruck('unit_number', e.target.value)} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Truck Type</Label>
            <Select value={entry.truck.truck_type} onValueChange={v => updateTruck('truck_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRUCK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Make</Label><Input value={entry.truck.make} onChange={e => updateTruck('make', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Model</Label><Input value={entry.truck.model} onChange={e => updateTruck('model', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Year</Label><Input type="number" value={entry.truck.year} onChange={e => updateTruck('year', parseInt(e.target.value) || new Date().getFullYear())} /></div>
          <div className="space-y-1"><Label className="text-xs">VIN</Label><Input value={entry.truck.vin} onChange={e => updateTruck('vin', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">License Plate</Label><Input value={entry.truck.license_plate} onChange={e => updateTruck('license_plate', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Insurance Expiry</Label><Input type="date" value={entry.truck.insurance_expiry || ''} onChange={e => updateTruck('insurance_expiry', e.target.value || null)} /></div>
          <div className="space-y-1"><Label className="text-xs">Registration Expiry</Label><Input type="date" value={entry.truck.registration_expiry || ''} onChange={e => updateTruck('registration_expiry', e.target.value || null)} /></div>
          <div className="space-y-1"><Label className="text-xs">Annual Inspection Expiry</Label><Input type="date" value={entry.truck.annual_inspection_expiry || ''} onChange={e => updateTruck('annual_inspection_expiry', e.target.value || null)} /></div>
        </div>
      </div>

      {/* Documents */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Driver & Truck Documents</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FileUploadBox label="License Photo" file={entry.license_photo} onChange={f => onFileChange('license_photo', f)} />
          <FileUploadBox label="Medical Card" file={entry.medical_card_photo} onChange={f => onFileChange('medical_card_photo', f)} />
          <FileUploadBox label="Truck Registration" file={entry.truck_registration} onChange={f => onFileChange('truck_registration', f)} />
          <FileUploadBox label="Truck Insurance" file={entry.truck_insurance} onChange={f => onFileChange('truck_insurance', f)} />
          <FileUploadBox label="Plate Photo" file={entry.truck_plate_photo} onChange={f => onFileChange('truck_plate_photo', f)} />
          <FileUploadBox label="Side Photo" file={entry.truck_side_photo} onChange={f => onFileChange('truck_side_photo', f)} />
          <FileUploadBox label="Rear Photo" file={entry.truck_rear_photo} onChange={f => onFileChange('truck_rear_photo', f)} />
          <FileUploadBox label="Cargo Area" file={entry.cargo_area_photo} onChange={f => onFileChange('cargo_area_photo', f)} />
        </div>
      </div>
    </div>
  );
}

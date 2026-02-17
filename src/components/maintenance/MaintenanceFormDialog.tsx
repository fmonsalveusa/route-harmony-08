import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MAINTENANCE_TYPES } from './maintenanceConstants';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbTruckMaintenance, MaintenanceInput } from '@/hooks/useTruckMaintenance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: DbTruck[];
  onSubmit: (input: MaintenanceInput) => Promise<boolean>;
  editItem?: DbTruckMaintenance | null;
}

export function MaintenanceFormDialog({ open, onOpenChange, trucks, onSubmit, editItem }: Props) {
  const [truckId, setTruckId] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('oil_change');
  const [customType, setCustomType] = useState('');
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0]);
  const [lastMiles, setLastMiles] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setTruckId(editItem.truck_id);
        const found = MAINTENANCE_TYPES.find(t => t.label === editItem.maintenance_type);
        setMaintenanceType(found?.key || 'custom');
        setCustomType(found ? '' : editItem.maintenance_type);
        setPerformedAt(editItem.last_performed_at);
        setLastMiles(String(editItem.last_miles));
        setIntervalMiles(editItem.interval_miles ? String(editItem.interval_miles) : '');
        setIntervalDays(editItem.interval_days ? String(editItem.interval_days) : '');
        setCost(editItem.cost ? String(editItem.cost) : '');
        setVendor(editItem.vendor || '');
        setDescription(editItem.description || '');
      } else {
        setTruckId(trucks[0]?.id || '');
        setMaintenanceType('oil_change');
        setCustomType('');
        setPerformedAt(new Date().toISOString().split('T')[0]);
        setLastMiles('');
        setIntervalMiles('10000');
        setIntervalDays('');
        setCost('');
        setVendor('');
        setDescription('');
        setCreateExpense(true);
      }
    }
  }, [open, editItem, trucks]);

  // Auto-fill default intervals when type changes
  useEffect(() => {
    if (!editItem) {
      const cfg = MAINTENANCE_TYPES.find(t => t.key === maintenanceType);
      if (cfg) {
        setIntervalMiles(cfg.defaultIntervalMiles ? String(cfg.defaultIntervalMiles) : '');
        setIntervalDays(cfg.defaultIntervalDays ? String(cfg.defaultIntervalDays) : '');
      }
    }
  }, [maintenanceType, editItem]);

  const handleSubmit = async () => {
    if (!truckId) return;
    setSaving(true);
    const typeLabel = maintenanceType === 'custom'
      ? customType
      : MAINTENANCE_TYPES.find(t => t.key === maintenanceType)?.label || maintenanceType;

    const ok = await onSubmit({
      truck_id: truckId,
      maintenance_type: typeLabel,
      description: description || null,
      interval_miles: intervalMiles ? Number(intervalMiles) : null,
      interval_days: intervalDays ? Number(intervalDays) : null,
      last_performed_at: performedAt,
      last_miles: Number(lastMiles) || 0,
      cost: cost ? Number(cost) : null,
      vendor: vendor || null,
      create_expense: createExpense,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Maintenance' : 'Add Maintenance Schedule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Truck</Label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
              <SelectContent>
                {trucks.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.unit_number} — {t.make} {t.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Maintenance Type</Label>
            <Select value={maintenanceType} onValueChange={setMaintenanceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map(t => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {maintenanceType === 'custom' && (
            <div>
              <Label>Custom Type Name</Label>
              <Input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. Belt Replacement" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date Performed</Label>
              <Input type="date" value={performedAt} onChange={e => setPerformedAt(e.target.value)} />
            </div>
            <div>
              <Label>Odometer (miles)</Label>
              <Input type="number" value={lastMiles} onChange={e => setLastMiles(e.target.value)} placeholder="150000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Interval (miles)</Label>
              <Input type="number" value={intervalMiles} onChange={e => setIntervalMiles(e.target.value)} placeholder="10000" />
            </div>
            <div>
              <Label>Interval (days)</Label>
              <Input type="number" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} placeholder="365" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Shop name" />
            </div>
          </div>

          {Number(cost) > 0 && !editItem && (
            <div className="flex items-center gap-2">
              <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
              <Label className="cursor-pointer">Create expense record</Label>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !truckId} className="w-full">
            {saving ? 'Saving...' : editItem ? 'Update' : 'Create Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

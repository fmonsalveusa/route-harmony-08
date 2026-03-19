import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MAINTENANCE_TYPES, MAINTENANCE_TYPE_LABELS, MAINTENANCE_CATEGORIES_BY_TYPE } from './maintenanceConstants';
import { PAYMENT_METHODS } from '@/components/expenses/expenseConstants';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbTruckMaintenance, MaintenanceInput } from '@/hooks/useTruckMaintenance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: DbTruck[];
  drivers: { id: string; name: string; service_type: string; truck_id: string | null }[];
  onSubmit: (input: MaintenanceInput) => Promise<boolean>;
  editItem?: DbTruckMaintenance | null;
}

export function MaintenanceFormDialog({ open, onOpenChange, trucks, drivers, onSubmit, editItem }: Props) {
  const companyDriverTrucks = trucks.filter(t => {
    const driver = drivers.find(d => d.truck_id === t.id);
    return driver && driver.service_type === 'company_driver';
  });
  const [truckId, setTruckId] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('oil_change');
  const [category, setCategory] = useState('');
  const [customType, setCustomType] = useState('');
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0]);
  const [lastMiles, setLastMiles] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [cost, setCost] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('other');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [isRecurring, setIsRecurring] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setTruckId(editItem.truck_id);
        const found = MAINTENANCE_TYPES.find(t => t.label === editItem.maintenance_type);
        setMaintenanceType(found?.key || 'custom');
        setCategory('');
        setCustomType(found ? '' : editItem.maintenance_type);
        setPerformedAt(editItem.last_performed_at);
        setLastMiles(String(editItem.last_miles));
        setIntervalMiles(editItem.interval_miles ? String(editItem.interval_miles) : '');
        setIntervalDays(editItem.interval_days ? String(editItem.interval_days) : '');
        setCost(editItem.cost ? String(editItem.cost) : '');
        setTaxAmount('');
        setVendor(editItem.vendor || '');
        setLocation('');
        setPaymentMethod('other');
        setInvoiceNumber('');
        setDescription(editItem.description || '');
        setNotes('');
        setIsRecurring(!!(editItem.interval_miles || editItem.interval_days));
      } else {
        setTruckId(companyDriverTrucks[0]?.id || '');
        setMaintenanceType('oil_change');
        setCategory('');
        setCustomType('');
        setPerformedAt(new Date().toISOString().split('T')[0]);
        setLastMiles('');
        setIntervalMiles('10000');
        setIntervalDays('');
        setCost('');
        setTaxAmount('');
        setVendor('');
        setLocation('');
        setPaymentMethod('other');
        setInvoiceNumber('');
        setDescription('');
        setNotes('');
        setCreateExpense(true);
        setIsRecurring(true);
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

  const selectedTruck = trucks.find(t => t.id === truckId);
  const assignedDriver = selectedTruck ? drivers.find(d => d.truck_id === selectedTruck.id) : null;
  const totalAmount = (parseFloat(cost) || 0) + (parseFloat(taxAmount) || 0);

  const handleSubmit = async () => {
    if (!truckId) return;
    setSaving(true);
    const typeLabel = maintenanceType === 'custom'
      ? customType
      : MAINTENANCE_TYPES.find(t => t.key === maintenanceType)?.label || maintenanceType;

    const fullDescription = [description, notes].filter(Boolean).join('\n').trim() || null;

    const ok = await onSubmit({
      truck_id: truckId,
      maintenance_type: typeLabel,
      description: fullDescription,
      interval_miles: isRecurring && intervalMiles ? Number(intervalMiles) : null,
      interval_days: isRecurring && intervalDays ? Number(intervalDays) : null,
      last_performed_at: performedAt,
      last_miles: Number(lastMiles) || 0,
      cost: cost ? Number(cost) : null,
      tax_amount: taxAmount ? Number(taxAmount) : null,
      vendor: vendor || null,
      payment_method: paymentMethod,
      location: location || null,
      invoice_number: invoiceNumber || null,
      create_expense: createExpense,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Maintenance' : 'Add Maintenance Schedule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date Performed *</Label>
                <Input type="date" value={performedAt} max={new Date().toISOString().split('T')[0]}
                  onChange={e => setPerformedAt(e.target.value)} />
              </div>
              <div>
                <Label>Truck *</Label>
                <Select value={truckId} onValueChange={setTruckId}>
                  <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                  <SelectContent>
                    {companyDriverTrucks.map(t => {
                      const driver = drivers.find(d => d.truck_id === t.id);
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {t.unit_number} - {driver?.name || 'No Driver'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {truckId && (
                <div className="md:col-span-2">
                  <Label>Assigned Driver</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm">{assignedDriver?.name || 'No driver assigned'}</span>
                    {assignedDriver && (
                      <Badge variant="outline" className={assignedDriver.service_type === 'company_driver' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                        {assignedDriver.service_type === 'company_driver' ? 'Company Driver' : 'Owner Operator'}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Maintenance Details */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Maintenance Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Maintenance Type *</Label>
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
                  <Label>Custom Type Name *</Label>
                  <Input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. Belt Replacement" />
                </div>
              )}
              <div className="md:col-span-2">
                <Label>Description * ({description.length}/500)</Label>
                <Textarea value={description} maxLength={500} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the maintenance in detail..." />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Schedule</h3>
            <div className="flex items-center gap-2 mb-4">
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              <Label className="cursor-pointer">Recurring maintenance</Label>
              {!isRecurring && <span className="text-xs text-muted-foreground ml-1">(one-time service)</span>}
            </div>
            {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Interval (miles)</Label>
                  <Input type="number" value={intervalMiles} onChange={e => setIntervalMiles(e.target.value)} placeholder="e.g. 10000" />
                </div>
                <div>
                  <Label>Interval (days)</Label>
                  <Input type="number" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} placeholder="e.g. 365" />
                </div>
              </div>
            )}
          </div>

          {/* Cost Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cost Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0.01" className="pl-7" value={cost}
                    onChange={e => setCost(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Tax Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" className="pl-7" value={taxAmount}
                    onChange={e => setTaxAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Total Amount</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md text-lg font-bold">
                  ${totalAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendor</Label>
                <Input value={vendor} maxLength={100}
                  onChange={e => setVendor(e.target.value)}
                  placeholder="e.g., Pilot, Love's" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} maxLength={100}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="City, State" />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Odometer Reading</Label>
                <Input type="number" value={lastMiles}
                  onChange={e => setLastMiles(e.target.value)}
                  placeholder="e.g., 125000" />
              </div>
              <div>
                <Label>Invoice/Receipt Number</Label>
                <Input value={invoiceNumber} maxLength={50}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g., INV-12345" />
              </div>
              <div className="md:col-span-2">
                <Label>Notes ({notes.length}/1000)</Label>
                <Textarea value={notes} maxLength={1000}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes..." />
              </div>
              {Number(cost) > 0 && !editItem && (
                <div className="flex items-center gap-2">
                  <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
                  <Label className="cursor-pointer text-sm">Create expense record</Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !truckId}>
            {saving ? 'Saving...' : editItem ? 'Update Maintenance' : 'Save Maintenance'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

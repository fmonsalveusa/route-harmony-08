import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, CATEGORIES_BY_TYPE, PAYMENT_METHODS } from './expenseConstants';
import type { DbTruck } from '@/hooks/useTrucks';
import type { CreateExpenseInput, DbExpense } from '@/hooks/useExpenses';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateExpenseInput) => Promise<any>;
  trucks: DbTruck[];
  drivers: { id: string; name: string; service_type: string; truck_id: string | null }[];
  editExpense?: DbExpense | null;
}

export function ExpenseFormDialog({ open, onOpenChange, onSubmit, trucks, drivers, editExpense }: Props) {
  const companyDriverTrucks = trucks.filter(t => {
    const driver = drivers.find(d => d.truck_id === t.id);
    return driver && driver.service_type === 'company_driver';
  });
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    truck_id: '',
    expense_type: 'fuel',
    category: '',
    description: '',
    amount: '',
    tax_amount: '',
    payment_method: 'fleet_card',
    vendor: '',
    location: '',
    odometer_reading: '',
    invoice_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setForm({
        expense_date: editExpense.expense_date,
        truck_id: editExpense.truck_id || '',
        expense_type: editExpense.expense_type,
        category: editExpense.category || '',
        description: editExpense.description,
        amount: String(editExpense.amount),
        tax_amount: editExpense.tax_amount ? String(editExpense.tax_amount) : '',
        payment_method: editExpense.payment_method,
        vendor: editExpense.vendor || '',
        location: editExpense.location || '',
        odometer_reading: editExpense.odometer_reading ? String(editExpense.odometer_reading) : '',
        invoice_number: editExpense.invoice_number || '',
        notes: editExpense.notes || '',
      });
    } else {
      setForm({
        expense_date: new Date().toISOString().split('T')[0],
        truck_id: '', expense_type: 'fuel', category: '', description: '',
        amount: '', tax_amount: '', payment_method: 'fleet_card',
        vendor: '', location: '', odometer_reading: '', invoice_number: '', notes: '',
      });
    }
  }, [editExpense, open]);

  const selectedTruck = companyDriverTrucks.find(t => t.id === form.truck_id);
  const assignedDriver = selectedTruck ? drivers.find(d => d.truck_id === selectedTruck.id) : null;
  const categories = CATEGORIES_BY_TYPE[form.expense_type] || [];
  const totalAmount = (parseFloat(form.amount) || 0) + (parseFloat(form.tax_amount) || 0);

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.expense_date) missing.push('Expense Date');
    if (!form.truck_id) missing.push('Truck');
    if (!form.expense_type) missing.push('Expense Type');
    if (!form.description.trim()) missing.push('Description');
    if (!form.amount || parseFloat(form.amount) <= 0) missing.push('Amount (positive)');
    if (!form.payment_method) missing.push('Payment Method');

    if (missing.length) {
      toast({ title: 'Missing required fields', description: missing.join(', '), variant: 'destructive' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (form.expense_date > today) {
      toast({ title: 'Invalid date', description: 'Date cannot be in the future', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const input: CreateExpenseInput = {
      expense_date: form.expense_date,
      truck_id: form.truck_id || null,
      driver_name: assignedDriver?.name || null,
      driver_service_type: assignedDriver?.service_type || null,
      expense_type: form.expense_type,
      category: form.category || null,
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : null,
      payment_method: form.payment_method,
      vendor: form.vendor.trim() || null,
      location: form.location.trim() || null,
      odometer_reading: form.odometer_reading ? parseFloat(form.odometer_reading) : null,
      invoice_number: form.invoice_number.trim() || null,
      notes: form.notes.trim() || null,
      source: 'manual',
    };
    await onSubmit(input);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Expense Date *</Label>
                <Input type="date" value={form.expense_date} max={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Truck *</Label>
                <Select value={form.truck_id} onValueChange={v => setForm({ ...form, truck_id: v })}>
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
              {form.truck_id && (
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

          {/* Expense Details */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Expense Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Expense Type *</Label>
                <Select value={form.expense_type} onValueChange={v => setForm({ ...form, expense_type: v, category: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...EXPENSE_TYPES].sort((a, b) => EXPENSE_TYPE_LABELS[a].localeCompare(EXPENSE_TYPE_LABELS[b])).map(t => (
                      <SelectItem key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categories.length > 0 && (
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {[...categories].sort((a, b) => a.label.localeCompare(b.label)).map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="md:col-span-2">
                <Label>Description * ({form.description.length}/500)</Label>
                <Textarea placeholder="Describe the expense in detail..." value={form.description}
                  maxLength={500} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Cost Info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cost Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0.01" className="pl-7" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Tax Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" className="pl-7" value={form.tax_amount}
                    onChange={e => setForm({ ...form, tax_amount: e.target.value })} placeholder="0.00" />
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
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
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
                <Input value={form.vendor} maxLength={100}
                  onChange={e => setForm({ ...form, vendor: e.target.value })}
                  placeholder="e.g., Pilot, Love's" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} maxLength={100}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="City, State" />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Odometer Reading</Label>
                <Input type="number" value={form.odometer_reading}
                  onChange={e => setForm({ ...form, odometer_reading: e.target.value })}
                  placeholder="e.g., 125000" />
              </div>
              <div>
                <Label>Invoice/Receipt Number</Label>
                <Input value={form.invoice_number} maxLength={50}
                  onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                  placeholder="e.g., INV-12345" />
              </div>
              <div className="md:col-span-2">
                <Label>Notes ({form.notes.length}/1000)</Label>
                <Textarea value={form.notes} maxLength={1000}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..." />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : editExpense ? 'Update Expense' : 'Save Expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

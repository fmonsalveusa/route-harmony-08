import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/components/expenses/expenseConstants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceType: string;
  onSubmit: (data: {
    last_performed_at: string;
    last_miles: number;
    cost?: number | null;
    tax_amount?: number | null;
    vendor?: string | null;
    payment_method?: string;
    location?: string | null;
    invoice_number?: string | null;
    create_expense?: boolean;
  }) => Promise<boolean>;
}

export function LogServiceDialog({ open, onOpenChange, maintenanceType, onSubmit }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [miles, setMiles] = useState('');
  const [cost, setCost] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('other');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  const totalAmount = (parseFloat(cost) || 0) + (parseFloat(taxAmount) || 0);

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await onSubmit({
      last_performed_at: date,
      last_miles: Number(miles) || 0,
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
          <DialogTitle>Log Service — {maintenanceType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date Performed</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Current Odometer (miles)</Label>
                <Input type="number" value={miles} onChange={e => setMiles(e.target.value)} placeholder="160000" />
              </div>
            </div>
          </div>

          {/* Cost Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cost Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" className="pl-7" value={cost}
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
                <Label>Payment Method</Label>
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
                <Input value={vendor} maxLength={100} onChange={e => setVendor(e.target.value)} placeholder="e.g. Shop name" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} maxLength={100} onChange={e => setLocation(e.target.value)} placeholder="City, State" />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Invoice/Receipt Number</Label>
                <Input value={invoiceNumber} maxLength={50} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g., INV-12345" />
              </div>
              {Number(cost) > 0 && (
                <div className="flex items-center gap-2 self-end pb-2">
                  <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
                  <Label className="cursor-pointer text-sm">Create expense record</Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Log Service'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

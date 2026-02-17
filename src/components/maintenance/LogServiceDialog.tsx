import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceType: string;
  onSubmit: (data: { last_performed_at: string; last_miles: number; cost?: number | null; vendor?: string | null; create_expense?: boolean }) => Promise<boolean>;
}

export function LogServiceDialog({ open, onOpenChange, maintenanceType, onSubmit }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [miles, setMiles] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await onSubmit({
      last_performed_at: date,
      last_miles: Number(miles) || 0,
      cost: cost ? Number(cost) : null,
      vendor: vendor || null,
      create_expense: createExpense,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Service — {maintenanceType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Date Performed</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Current Odometer (miles)</Label>
            <Input type="number" value={miles} onChange={e => setMiles(e.target.value)} placeholder="160000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={e => setVendor(e.target.value)} />
            </div>
          </div>
          {Number(cost) > 0 && (
            <div className="flex items-center gap-2">
              <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
              <Label className="cursor-pointer text-sm">Create expense record</Label>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Log Service'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

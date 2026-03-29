import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayET } from '@/lib/dateUtils';
import { DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatcher?: DbDispatcher | null;
  onSubmit: (data: DispatcherInput) => Promise<void>;
}

const emptyForm: DispatcherInput = {
  name: '', email: '', phone: '',
  status: 'active',
  commission_percentage: 8,
  commission_2_percentage: 0,
  dispatch_service_percentage: 0,
  pay_type: 'per_rate',
  start_date: todayET(),
};

export function DispatcherFormDialog({ open, onOpenChange, dispatcher, onSubmit }: Props) {
  const [form, setForm] = useState<DispatcherInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dispatcher) {
      setForm({
        name: dispatcher.name, email: dispatcher.email, phone: dispatcher.phone,
        status: dispatcher.status, commission_percentage: dispatcher.commission_percentage,
        commission_2_percentage: dispatcher.commission_2_percentage,
        dispatch_service_percentage: dispatcher.dispatch_service_percentage,
        pay_type: dispatcher.pay_type, start_date: dispatcher.start_date,
      });
    } else {
      setForm(emptyForm);
    }
  }, [dispatcher, open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('Name');
    if (!form.email.trim()) missing.push('Email');
    if (!form.phone.trim()) missing.push('Phone');
    if (missing.length > 0) {
      toast.error(`Required fields: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dispatcher ? 'Edit Dispatcher' : 'New Dispatcher'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>% Commission 1</Label>
            <Input type="number" value={form.commission_percentage} onChange={e => set('commission_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>% Commission 2</Label>
            <Input type="number" value={form.commission_2_percentage} onChange={e => set('commission_2_percentage', Number(e.target.value))} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>% Dispatch Service</Label>
            <Input type="number" value={form.dispatch_service_percentage} onChange={e => set('dispatch_service_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Pay Type</Label>
            <Select value={form.pay_type} onValueChange={v => set('pay_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_rate">Per Rate</SelectItem>
                <SelectItem value="per_load">Per Load</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : dispatcher ? 'Save Changes' : 'Create Dispatcher'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

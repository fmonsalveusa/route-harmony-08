import { useState, useEffect } from 'react';
import { WhatsAppGroupSelect } from '@/components/WhatsAppGroupSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayET } from '@/lib/dateUtils';
import { DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { toast } from 'sonner';
import { Headset } from 'lucide-react';

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
  color: '#94A3B8',
  whatsapp_group_id: null,
  whatsapp_group_name: null,
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
        color: dispatcher.color || '#94A3B8',
        whatsapp_group_id: (dispatcher as any).whatsapp_group_id || null,
        whatsapp_group_name: (dispatcher as any).whatsapp_group_name || null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:h-10 [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:h-10 [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
              <Headset className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{dispatcher ? 'Edit Dispatcher' : 'New Dispatcher'}</DialogTitle>
              <p className="text-sm text-[#444746] dark:text-muted-foreground">{dispatcher ? dispatcher.name : 'Completa la información del dispatcher'}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 mt-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555-0000" />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>% Commission 1</Label>
            <Input type="number" value={form.commission_percentage} onChange={e => set('commission_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>% Commission 2</Label>
            <Input type="number" value={form.commission_2_percentage} onChange={e => set('commission_2_percentage', Number(e.target.value))} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label>% Dispatch Service</Label>
            <Input type="number" value={form.dispatch_service_percentage} onChange={e => set('dispatch_service_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Pay Type</Label>
            <Select value={form.pay_type} onValueChange={v => set('pay_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_rate">Per Rate</SelectItem>
                <SelectItem value="per_load">Per Load</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <WhatsAppGroupSelect
            className="sm:col-span-2"
            groupId={form.whatsapp_group_id ?? null}
            groupName={form.whatsapp_group_name ?? null}
            onChange={(id, name) => setForm(prev => ({ ...prev, whatsapp_group_id: id, whatsapp_group_name: name }))}
            hint="Aquí llegan los recibos cuando un pago del dispatcher se marca Paid."
          />
          <div className="space-y-2 sm:col-span-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color || '#94A3B8'}
                onChange={e => set('color', e.target.value)}
                className="h-9 w-14 rounded border cursor-pointer"
              />
              <Input
                value={form.color || '#94A3B8'}
                onChange={e => set('color', e.target.value)}
                placeholder="#94A3B8"
                className="font-mono text-sm"
              />
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                style={{ backgroundColor: form.color || '#94A3B8' }}
              >
                {form.name ? form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '—'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : dispatcher ? 'Save Changes' : 'Create Dispatcher'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

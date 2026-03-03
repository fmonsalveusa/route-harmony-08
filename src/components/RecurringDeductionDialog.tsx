import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2, RefreshCw, CalendarIcon } from 'lucide-react';
import { useRecurringDeductions, type DbRecurringDeduction } from '@/hooks/useRecurringDeductions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ADJUSTMENT_REASONS } from '@/hooks/usePaymentAdjustments';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREQUENCIES = [
  { value: 'per_load', label: 'Per Load' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface RecipientOption {
  id: string;
  name: string;
  type: 'driver' | 'investor';
}

export function RecurringDeductionDialog({ open, onOpenChange }: Props) {
  const { deductions, loading, createDeduction, updateDeduction, deleteDeduction, toggleActive } = useRecurringDeductions();
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [recipientKey, setRecipientKey] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('per_load');
  const [reason, setReason] = useState('other');
  const [effectiveFrom, setEffectiveFrom] = useState<Date>(new Date());

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('drivers').select('id, name, investor_name');
      const opts: RecipientOption[] = [];
      for (const d of (data as any[]) || []) {
        opts.push({ id: d.id, name: d.name, type: 'driver' });
        if (d.investor_name) {
          opts.push({ id: d.id, name: d.investor_name, type: 'investor' });
        }
      }
      setRecipients(opts);
    })();
  }, [open]);

  const resetForm = () => {
    setRecipientKey('');
    setDescription('');
    setAmount('');
    setFrequency('per_load');
    setReason('other');
    setEffectiveFrom(new Date());
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (d: DbRecurringDeduction) => {
    setRecipientKey(`${d.recipient_type}::${d.recipient_id}`);
    setDescription(d.description);
    setAmount(String(d.amount));
    setFrequency(d.frequency);
    setReason(d.reason);
    setEffectiveFrom(d.effective_from ? new Date(d.effective_from + 'T00:00:00') : new Date());
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const parts = recipientKey.split('::');
    if (parts.length < 2 || !description || !amount) return;
    const [type, id] = parts;
    const recipient = recipients.find(r => r.id === id && r.type === type);
    if (!recipient) return;

    const payload = {
      recipient_id: id,
      recipient_type: type,
      recipient_name: recipient.name,
      description,
      amount: Number(amount),
      frequency,
      reason,
      effective_from: effectiveFrom.toISOString().split('T')[0],
    };

    const ok = editingId
      ? await updateDeduction(editingId, payload)
      : await createDeduction(payload);
    if (ok) resetForm();
  };

  // Group deductions by recipient
  const grouped = deductions.reduce<Record<string, DbRecurringDeduction[]>>((acc, d) => {
    const key = `${d.recipient_name} (${d.recipient_type})`;
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Recurring Deductions</DialogTitle>
          <DialogDescription>Configure automatic deductions applied to driver/investor payments.</DialogDescription>
        </DialogHeader>

        {!showForm && (
          <Button size="sm" className="w-fit" onClick={() => setShowForm(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Add Deduction
          </Button>
        )}

        {showForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Recipient</Label>
                  <Select value={recipientKey} onValueChange={setRecipientKey}>
                    <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                    <SelectContent>
                      {recipients.map(r => (
                        <SelectItem key={`${r.type}::${r.id}`} value={`${r.type}::${r.id}`}>
                          {r.name} <span className="text-muted-foreground ml-1">({r.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Weekly Insurance" />
                </div>
                <div className="space-y-1">
                  <Label>Amount ($)</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Effective From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !effectiveFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {effectiveFrom ? format(effectiveFrom, 'MM/dd/yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={effectiveFrom} onSelect={(d) => d && setEffectiveFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>{editingId ? 'Update' : 'Add'}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recurring deductions configured yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                <h3 className="text-sm font-semibold mb-2">{label}</h3>
                <div className="space-y-1.5">
                  {items.map(d => (
                    <div key={d.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${!d.is_active ? 'opacity-50' : ''}`}>
                      <Switch checked={d.is_active} onCheckedChange={(v) => toggleActive(d.id, v)} className="scale-75" />
                      <span className="flex-1 font-medium">{d.description}</span>
                      <Badge variant="outline" className="text-xs">{FREQUENCIES.find(f => f.value === d.frequency)?.label}</Badge>
                      {d.effective_from && <span className="text-xs text-muted-foreground">from {d.effective_from}</span>}
                      <span className="font-semibold text-destructive">-${Number(d.amount).toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDeduction(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

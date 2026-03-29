import { useState } from 'react';
import { useLoadAdjustments } from '@/hooks/useLoadAdjustments';
import { ADJUSTMENT_REASONS } from '@/hooks/usePaymentAdjustments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';

interface LoadAdjustmentsSectionProps {
  loadId: string;
}

export function LoadAdjustmentsSection({ loadId }: LoadAdjustmentsSectionProps) {
  const { adjustments, availableRecipients, loading, addAdjustment, deleteAdjustment } = useLoadAdjustments(loadId);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<string>('deduction');
  const [reason, setReason] = useState<string>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [applyTo, setApplyTo] = useState<string[]>([]);

  // Don't render if no driver is assigned (no recipients available)
  if (!loading && availableRecipients.length === 0) return null;

  const resetForm = () => {
    setType('deduction');
    setReason('other');
    setAmount('');
    setDescription('');
    setApplyTo([]);
    setShowForm(false);
  };

  const handleOpenForm = () => {
    // Pre-select all available recipients
    setApplyTo([...availableRecipients]);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || applyTo.length === 0) return;

    setSaving(true);
    const ok = await addAdjustment({
      adjustment_type: type,
      reason,
      description: description.trim() || undefined,
      amount: numAmount,
      applyTo,
    });
    setSaving(false);
    if (ok) resetForm();
  };

  const toggleRecipient = (r: string) => {
    setApplyTo(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const reasonLabel = (value: string) => ADJUSTMENT_REASONS.find(r => r.value === value)?.label || value;

  return (
    <div className="p-3 rounded-lg bg-card border text-sm">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold text-sm">Load Adjustments</h5>
        {!showForm && (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleOpenForm}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>

      {/* Existing adjustments */}
      {adjustments.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {adjustments.map(adj => (
            <div key={adj.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={adj.adjustment_type === 'addition' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                    {adj.adjustment_type === 'addition' ? '+' : '−'}${Number(adj.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Badge>
                  <span className="text-xs font-medium">{reasonLabel(adj.reason)}</span>
                  {adj.apply_to?.map((r: string) => (
                    <Badge key={r} variant="outline" className="text-[10px] px-1 py-0 capitalize">{r}</Badge>
                  ))}
                </div>
                {adj.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{adj.description}</p>}
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteAdjustment(adj.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {adjustments.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">No adjustments yet</p>
      )}

      {/* Add form */}
      {showForm && (
        <div className="space-y-2 p-2 rounded border bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="addition">Addition</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            placeholder="Amount"
            className="h-8 text-xs"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
          <Input
            placeholder="Description (optional)"
            className="h-8 text-xs"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Apply to:</span>
            {availableRecipients.map(r => (
              <label key={r} className="flex items-center gap-1.5 text-xs capitalize cursor-pointer">
                <Checkbox
                  checked={applyTo.includes(r)}
                  onCheckedChange={() => toggleRecipient(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={saving || !amount || parseFloat(amount) <= 0 || applyTo.length === 0}
              onClick={handleSubmit}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

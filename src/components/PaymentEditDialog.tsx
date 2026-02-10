import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaymentAdjustments, ADJUSTMENT_REASONS } from '@/hooks/usePaymentAdjustments';
import type { DbPayment } from '@/hooks/usePayments';
import { Plus, Trash2, FileText, PlusCircle, MinusCircle, Pencil, Check, X } from 'lucide-react';
import { generatePaymentReceipt } from '@/lib/paymentReceipt';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  payment: DbPayment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PaymentEditDialog = ({ payment, open, onOpenChange }: Props) => {
  const { adjustments, addAdjustment, deleteAdjustment, totalAdjustment } = usePaymentAdjustments(payment.id);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adjType, setAdjType] = useState<string>('addition');
  const [adjReason, setAdjReason] = useState<string>('detention');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [newRate, setNewRate] = useState(String(payment.total_rate));
  const [currentRate, setCurrentRate] = useState(Number(payment.total_rate));
  const [currentBaseAmount, setCurrentBaseAmount] = useState(Number(payment.amount));
  const [savingRate, setSavingRate] = useState(false);

  const finalAmount = currentBaseAmount + totalAdjustment;

  const handleAdd = async () => {
    const amt = parseFloat(adjAmount);
    if (isNaN(amt) || amt <= 0) return;
    const ok = await addAdjustment({
      adjustment_type: adjType,
      reason: adjReason,
      description: adjDesc || undefined,
      amount: amt,
    });
    if (ok) {
      setAdjAmount('');
      setAdjDesc('');
      setShowAddForm(false);
    }
  };

  const handleSaveRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) return;
    setSavingRate(true);
    const newAmount = Math.round(rate * (payment.percentage_applied / 100) * 100) / 100;
    const { error } = await supabase
      .from('payments')
      .update({ total_rate: rate, amount: newAmount } as any)
      .eq('id', payment.id);
    setSavingRate(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setCurrentRate(rate);
    setCurrentBaseAmount(newAmount);
    setEditingRate(false);
    toast({ title: 'Rate actualizado' });
  };

  const handleGenerateReceipt = () => {
    const updatedPayment = { ...payment, total_rate: currentRate, amount: currentBaseAmount };
    generatePaymentReceipt(updatedPayment, adjustments, totalAdjustment, finalAmount);
  };

  const reasonLabel = (r: string) => ADJUSTMENT_REASONS.find(a => a.value === r)?.label || r;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Pago — {payment.load_reference}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment summary */}
          <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-lg bg-muted/50">
            <div><span className="text-muted-foreground">Beneficiario:</span> <span className="font-medium">{payment.recipient_name}</span></div>
            <div>
              <span className="text-muted-foreground">Rate:</span>{' '}
              {editingRate ? (
                <span className="inline-flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    className="h-6 w-24 text-xs inline-block"
                  />
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveRate} disabled={savingRate}>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingRate(false); setNewRate(String(currentRate)); }}>
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </span>
              ) : (
                <span className="font-medium">
                  ${currentRate.toLocaleString()}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1 inline-flex" onClick={() => { setEditingRate(true); setNewRate(String(currentRate)); }}>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </span>
              )}
            </div>
            <div><span className="text-muted-foreground">Porcentaje:</span> <span className="font-medium">{payment.percentage_applied}%</span></div>
            <div><span className="text-muted-foreground">Monto Base:</span> <span className="font-medium">${currentBaseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
          </div>

          {/* Adjustments list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">Ajustes</h4>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-3.5 w-3.5" /> Agregar Ajuste
              </Button>
            </div>

            {adjustments.length === 0 && !showAddForm && (
              <p className="text-xs text-muted-foreground italic py-2">Sin ajustes</p>
            )}

            {adjustments.map(adj => (
              <div key={adj.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  {adj.adjustment_type === 'addition'
                    ? <PlusCircle className="h-4 w-4 text-green-600" />
                    : <MinusCircle className="h-4 w-4 text-red-600" />
                  }
                  <div>
                    <span className="font-medium">{reasonLabel(adj.reason)}</span>
                    {adj.description && <span className="text-muted-foreground ml-1">— {adj.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${adj.adjustment_type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                    {adj.adjustment_type === 'addition' ? '+' : '-'}${Number(adj.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteAdjustment(adj.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add adjustment form */}
            {showAddForm && (
              <div className="mt-3 p-3 border rounded-lg space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={adjType} onValueChange={setAdjType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="addition">Addition (+)</SelectItem>
                        <SelectItem value="deduction">Deduction (−)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo</Label>
                    <Select value={adjReason} onValueChange={setAdjReason}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_REASONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monto ($)</Label>
                  <Input type="number" min="0" step="0.01" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} className="h-8 text-sm" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descripción (opcional)</Label>
                  <Textarea value={adjDesc} onChange={e => setAdjDesc(e.target.value)} className="text-sm min-h-[60px]" placeholder="Detalle del ajuste..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>Guardar Ajuste</Button>
                </div>
              </div>
            )}
          </div>

          {/* Final amount */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-semibold">
            <span>Monto Final</span>
            <span className="text-lg text-primary">${finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerateReceipt}>
            <FileText className="h-4 w-4" /> Generar Recibo PDF
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

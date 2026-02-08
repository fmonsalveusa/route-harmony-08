import { useState, useEffect, useCallback } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { usePayments, type DbPayment } from '@/hooks/usePayments';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PaymentEditDialog } from '@/components/PaymentEditDialog';
import { DollarSign, CheckCircle, Clock, Download, Pencil, Trash2, FileText, CheckCheck } from 'lucide-react';
import { generatePaymentReceipt } from '@/lib/paymentReceipt';
import { generateBatchPaymentReceipt } from '@/lib/batchPaymentReceipt';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const handleGenerateReceipt = async (p: DbPayment) => {
  const { data } = await supabase.from('payment_adjustments').select('*').eq('payment_id', p.id).order('created_at', { ascending: true });
  const adjustments = (data as any[]) || [];
  const totalAdj = adjustments.reduce((sum: number, a: any) => sum + (a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount)), 0);
  generatePaymentReceipt(p, adjustments, totalAdj, Number(p.amount) + totalAdj);
};

interface PaymentsSectionProps {
  type: 'driver' | 'investor' | 'dispatcher';
}

const PaymentsSection = ({ type }: PaymentsSectionProps) => {
  const { payments: allPayments, loading, updatePaymentStatus, refetch } = usePayments();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editPayment, setEditPayment] = useState<DbPayment | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [adjMap, setAdjMap] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Fetch all adjustments for payments of this type
  const fetchAdjustments = useCallback(async () => {
    const ids = allPayments.filter(p => p.recipient_type === type).map(p => p.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('payment_adjustments').select('payment_id, adjustment_type, amount').in('payment_id', ids);
    if (data) {
      const map: Record<string, number> = {};
      (data as any[]).forEach(a => {
        const val = a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount);
        map[a.payment_id] = (map[a.payment_id] || 0) + val;
      });
      setAdjMap(map);
    }
  }, [allPayments, type]);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  // Clear selection when filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter]);

  const allTypePayments = allPayments.filter(p => p.recipient_type === type);
  const pendingCount = allTypePayments.filter(p => p.status === 'pending').length;
  const inProcessCount = allTypePayments.filter(p => p.status === 'in_process').length;
  const paidCount = allTypePayments.filter(p => p.status === 'paid').length;

  const payments = statusFilter === 'all' ? allTypePayments : allTypePayments.filter(p => p.status === statusFilter);

  const totalPending = allTypePayments.filter(p => p.status === 'pending' || p.status === 'in_process').reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);
  const totalPaid = allTypePayments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payments.map(p => p.id)));
    }
  };

  const selectedPayments = payments.filter(p => selectedIds.has(p.id));

  // Validate selection: all must be same recipient
  const canBatchPay = selectedPayments.length > 0 &&
    new Set(selectedPayments.map(p => p.recipient_id)).size === 1;

  const selectedTotal = selectedPayments.reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);

  const handleBatchPayAndReceipt = async () => {
    if (!canBatchPay) {
      toast({ title: 'Error', description: 'Selecciona pagos del mismo beneficiario.', variant: 'destructive' });
      return;
    }
    setBatchProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Update all selected to paid
      for (const p of selectedPayments) {
        await supabase.from('payments').update({ status: 'paid', payment_date: today }).eq('id', p.id);
      }

      // Generate batch receipt
      const items = selectedPayments.map(p => ({
        payment: p,
        adjustment: adjMap[p.id] || 0,
        finalAmount: Number(p.amount) + (adjMap[p.id] || 0),
      }));
      generateBatchPaymentReceipt(selectedPayments[0].recipient_name, selectedPayments[0].recipient_type, items);

      toast({ title: `${selectedPayments.length} pago(s) marcados como pagados`, description: 'Recibo grupal generado.' });
      setSelectedIds(new Set());
      refetch();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchReceiptOnly = () => {
    if (!canBatchPay) {
      toast({ title: 'Error', description: 'Selecciona pagos del mismo beneficiario.', variant: 'destructive' });
      return;
    }
    const items = selectedPayments.map(p => ({
      payment: p,
      adjustment: adjMap[p.id] || 0,
      finalAmount: Number(p.amount) + (adjMap[p.id] || 0),
    }));
    generateBatchPaymentReceipt(selectedPayments[0].recipient_name, selectedPayments[0].recipient_type, items);
    toast({ title: 'Recibo grupal generado' });
  };

  const handleDelete = async () => {
    if (!deletePaymentId) return;
    const { error } = await supabase.from('payments').delete().eq('id', deletePaymentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pago eliminado' });
      refetch();
    }
    setDeletePaymentId(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Pendiente" value={`$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={Clock} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Total Pagado" value={`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total General" value={`$${(totalPending + totalPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={DollarSign} />
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="in_process">In Process ({inProcessCount})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({paidCount})</TabsTrigger>
          <TabsTrigger value="all">Todos ({allTypePayments.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
          <span className="text-sm font-medium">{selectedIds.size} seleccionado(s)</span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm font-semibold">${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          {!canBatchPay && selectedPayments.length > 0 && (
            <span className="text-xs text-destructive ml-2">⚠ Selecciona pagos del mismo beneficiario</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBatchReceiptOnly} disabled={!canBatchPay}>
              <FileText className="h-3.5 w-3.5" /> Recibo
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleBatchPayAndReceipt} disabled={!canBatchPay || batchProcessing}>
              <CheckCheck className="h-3.5 w-3.5" /> Pagar y Generar Recibo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b bg-muted/50">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={payments.length > 0 && selectedIds.size === payments.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Beneficiario</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
                <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto Base</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ajuste</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto Total</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
              </tr></thead>
              <tbody>
                {payments.length === 0 && !loading && (
                  <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Sin pagos registrados</td></tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="p-3 font-medium text-primary">{p.load_reference}</td>
                    <td className="p-3">{p.recipient_name}</td>
                    <td className="p-3 text-right text-muted-foreground">${Number(p.total_rate).toLocaleString()}</td>
                    <td className="p-3 text-right text-muted-foreground">{p.percentage_applied}%</td>
                    <td className="p-3 text-right text-muted-foreground">${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">
                      {(adjMap[p.id] || 0) !== 0 ? (
                        <span className={`font-semibold ${(adjMap[p.id] || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(adjMap[p.id] || 0) > 0 ? '+' : ''}${(adjMap[p.id] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right font-semibold">${(Number(p.amount) + (adjMap[p.id] || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Select value={p.status} onValueChange={(val) => updatePaymentStatus(p.id, val)}>
                        <SelectTrigger className="h-8 w-[130px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:ml-1">
                          <StatusBadge status={p.status} className="text-sm px-3 py-1" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="pending"><StatusBadge status="pending" /></SelectItem>
                          <SelectItem value="in_process"><StatusBadge status="in_process" /></SelectItem>
                          <SelectItem value="paid"><StatusBadge status="paid" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.payment_date ? formatDate(p.payment_date) : formatDate(p.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditPayment(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeletePaymentId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Generar Recibo PDF" onClick={() => handleGenerateReceipt(p)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editPayment && (
        <PaymentEditDialog payment={editPayment} open={!!editPayment} onOpenChange={(o) => { if (!o) { setEditPayment(null); fetchAdjustments(); } }} />
      )}

      <AlertDialog open={!!deletePaymentId} onOpenChange={(o) => { if (!o) setDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Payments = () => {
  const { payments: allP } = usePayments();
  const pendingDrivers = allP.filter(p => p.recipient_type === 'driver' && (p.status === 'pending' || p.status === 'in_process')).length;
  const pendingInvestors = allP.filter(p => p.recipient_type === 'investor' && (p.status === 'pending' || p.status === 'in_process')).length;
  const pendingDispatchers = allP.filter(p => p.recipient_type === 'dispatcher' && (p.status === 'pending' || p.status === 'in_process')).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Pagos</h1>
          <p className="page-description">Gestión de pagos a drivers, investors y dispatchers</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Exportar</Button>
      </div>

      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">Drivers {pendingDrivers > 0 && <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold min-w-[20px] h-5 px-1.5">{pendingDrivers}</span>}</TabsTrigger>
          <TabsTrigger value="investors">Investors {pendingInvestors > 0 && <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold min-w-[20px] h-5 px-1.5">{pendingInvestors}</span>}</TabsTrigger>
          <TabsTrigger value="dispatchers">Dispatchers {pendingDispatchers > 0 && <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold min-w-[20px] h-5 px-1.5">{pendingDispatchers}</span>}</TabsTrigger>
        </TabsList>
        <TabsContent value="drivers"><PaymentsSection type="driver" /></TabsContent>
        <TabsContent value="investors"><PaymentsSection type="investor" /></TabsContent>
        <TabsContent value="dispatchers"><PaymentsSection type="dispatcher" /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Payments;

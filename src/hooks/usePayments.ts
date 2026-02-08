import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DbPayment {
  id: string;
  load_id: string;
  recipient_type: string;
  recipient_id: string;
  recipient_name: string;
  load_reference: string;
  amount: number;
  percentage_applied: number;
  total_rate: number;
  status: string;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayments() {
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setPayments((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const updatePaymentStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'paid') updates.payment_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('payments').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Pago actualizado' });
    fetchPayments();
    return true;
  };

  return { payments, loading, updatePaymentStatus, refetch: fetchPayments };
}

/** Generate payments for a delivered load */
export async function generatePaymentsForLoad(load: {
  id: string;
  reference_number: string;
  total_rate: number;
  driver_id?: string | null;
  dispatcher_id?: string | null;
}, driver: {
  id: string;
  name: string;
  pay_percentage: number;
  investor_pay_percentage?: number | null;
  investor_name?: string | null;
  service_type?: string;
} | null, dispatcher: {
  id: string;
  name: string;
  commission_percentage: number;
  dispatch_service_percentage?: number;
} | null) {
  const paymentsToInsert: any[] = [];
  const totalRate = Number(load.total_rate);

  // Driver payment
  if (driver && driver.pay_percentage > 0) {
    const driverAmount = totalRate * (driver.pay_percentage / 100);
    paymentsToInsert.push({
      load_id: load.id,
      recipient_type: 'driver',
      recipient_id: driver.id,
      recipient_name: driver.name,
      load_reference: load.reference_number,
      amount: Math.round(driverAmount * 100) / 100,
      percentage_applied: driver.pay_percentage,
      total_rate: totalRate,
    });
  }

  // Investor payment
  if (driver && driver.investor_pay_percentage && driver.investor_pay_percentage > 0 && driver.investor_name) {
    const investorAmount = totalRate * (driver.investor_pay_percentage / 100);
    paymentsToInsert.push({
      load_id: load.id,
      recipient_type: 'investor',
      recipient_id: driver.id,
      recipient_name: driver.investor_name,
      load_reference: load.reference_number,
      amount: Math.round(investorAmount * 100) / 100,
      percentage_applied: driver.investor_pay_percentage,
      total_rate: totalRate,
    });
  }

  // Dispatcher payment — percentage depends on driver's service_type
  if (dispatcher) {
    const driverServiceType = driver?.service_type || 'owner_operator';
    const dispatcherPct = driverServiceType === 'dispatch_service'
      ? (dispatcher.dispatch_service_percentage ?? 0)
      : dispatcher.commission_percentage;

    if (dispatcherPct > 0) {
      const dispatcherAmount = totalRate * (dispatcherPct / 100);
      paymentsToInsert.push({
        load_id: load.id,
        recipient_type: 'dispatcher',
        recipient_id: dispatcher.id,
        recipient_name: dispatcher.name,
        load_reference: load.reference_number,
        amount: Math.round(dispatcherAmount * 100) / 100,
        percentage_applied: dispatcherPct,
        total_rate: totalRate,
      });
    }
  }

  if (paymentsToInsert.length === 0) return;

  // Check if payments already exist for this load
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('load_id', load.id);

  if (existing && existing.length > 0) return; // already generated

  const { error } = await supabase.from('payments').insert(paymentsToInsert);
  if (error) {
    toast({ title: 'Error generando pagos', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: `${paymentsToInsert.length} pago(s) generado(s) automáticamente` });
  }
}

/** Delete all payments for a load (when status reverts from delivered) */
export async function deletePaymentsForLoad(loadId: string) {
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('load_id', loadId);

  if (!existing || existing.length === 0) return;

  const { error } = await supabase.from('payments').delete().eq('load_id', loadId);
  if (error) {
    toast({ title: 'Error eliminando pagos', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: `${existing.length} pago(s) eliminado(s) automáticamente` });
  }
}

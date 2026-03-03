import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';
import { getISOWeek } from '@/lib/dateUtils';

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
    toast({ title: 'Payment updated' });
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

  // Dispatcher payment is now generated manually from the Payments > Dispatchers tab

  if (paymentsToInsert.length === 0) return;

  // Check if driver/investor payments already exist for this load
  // (dispatcher payments are created separately and should not block this)
  const { data: existing } = await supabase
    .from('payments')
    .select('id, recipient_type')
    .eq('load_id', load.id);

  const nonDispatcherExisting = (existing || []).filter(
    (p: any) => p.recipient_type !== 'dispatcher'
  );
  if (nonDispatcherExisting.length > 0) return; // driver/investor payments already generated

  const tenant_id = await getTenantId();
  const withTenant = paymentsToInsert.map(p => ({ ...p, tenant_id }));
  const { error } = await supabase.from('payments').insert(withTenant as any);
  if (error) {
    toast({ title: 'Error generating payments', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: `${paymentsToInsert.length} payment(s) generated automatically` });

    // Fetch the newly created payments separately to avoid .insert().select() RLS issues
    const { data: createdPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('load_id', load.id);

    if (createdPayments && createdPayments.length > 0) {
      // Propagate pending load_adjustments to payment_adjustments
      const { data: loadAdjs } = await supabase
        .from('load_adjustments')
        .select('*')
        .eq('load_id', load.id);

      if (loadAdjs && loadAdjs.length > 0) {
        const payAdjsToInsert: any[] = [];

        for (const adj of loadAdjs as any[]) {
          const applyTo: string[] = Array.isArray(adj.apply_to) ? adj.apply_to : [];
          const matchingPayments = (createdPayments as any[]).filter(
            (p: any) => applyTo.includes(p.recipient_type)
          );

          for (const payment of matchingPayments) {
            payAdjsToInsert.push({
              payment_id: payment.id,
              adjustment_type: adj.adjustment_type,
              reason: adj.reason,
              description: adj.description,
              amount: adj.amount,
              load_adjustment_id: adj.id,
              tenant_id,
            });
          }
        }

        if (payAdjsToInsert.length > 0) {
          const { error: paError } = await supabase
            .from('payment_adjustments')
            .insert(payAdjsToInsert as any);

          if (paError) {
            console.error('Error propagating load adjustments to payments:', paError);
          }
        }
      }

      // ─── Auto-apply recurring deductions ───
      await applyRecurringDeductions(createdPayments as any[], tenant_id);
    }
  }
}

/** Apply recurring deductions for each payment recipient */
async function applyRecurringDeductions(payments: any[], tenant_id: string | null) {
  if (!payments || payments.length === 0) return;

  // Get unique recipient ids
  const recipientIds = [...new Set(payments.map((p: any) => p.recipient_id))];

  const { data: allDeductions } = await supabase
    .from('recurring_deductions' as any)
    .select('*')
    .eq('is_active', true)
    .in('recipient_id', recipientIds);

  if (!allDeductions || allDeductions.length === 0) return;

  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const adjsToInsert: any[] = [];

  for (const payment of payments) {
    const deductions = (allDeductions as any[]).filter(
      (d: any) => d.recipient_id === payment.recipient_id && d.recipient_type === payment.recipient_type
    );

    for (const ded of deductions) {
      if (ded.frequency === 'per_load') {
        // Check effective_from date
        if (ded.effective_from && new Date(ded.effective_from + 'T00:00:00') > now) continue;
        // Always apply
        adjsToInsert.push({
          payment_id: payment.id,
          adjustment_type: 'deduction',
          reason: ded.reason,
          description: ded.description,
          amount: ded.amount,
          recurring_deduction_id: ded.id,
          tenant_id,
        });
      } else {
        // weekly or monthly — check effective_from and if already applied in this period
        if (ded.effective_from && new Date(ded.effective_from + 'T00:00:00') > now) continue;
        const { data: existing } = await supabase
          .from('payment_adjustments' as any)
          .select('id, created_at')
          .eq('recurring_deduction_id', ded.id);

        const alreadyApplied = (existing || []).some((adj: any) => {
          const adjDate = new Date(adj.created_at);
          if (ded.frequency === 'weekly') {
            return getISOWeek(adjDate) === currentWeek && adjDate.getFullYear() === currentYear;
          }
          // monthly
          return adjDate.getMonth() === currentMonth && adjDate.getFullYear() === currentYear;
        });

        if (!alreadyApplied) {
          adjsToInsert.push({
            payment_id: payment.id,
            adjustment_type: 'deduction',
            reason: ded.reason,
            description: ded.description,
            amount: ded.amount,
            recurring_deduction_id: ded.id,
            tenant_id,
          });
        }
      }
    }
  }

  if (adjsToInsert.length > 0) {
    const { error } = await supabase.from('payment_adjustments').insert(adjsToInsert as any);
    if (error) {
      console.error('Error applying recurring deductions:', error);
    }
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
    toast({ title: 'Error deleting payments', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: `${existing.length} payment(s) deleted automatically` });
  }
}

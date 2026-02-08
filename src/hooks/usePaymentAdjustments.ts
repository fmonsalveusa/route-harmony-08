import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbPaymentAdjustment {
  id: string;
  payment_id: string;
  adjustment_type: string;
  reason: string;
  description: string | null;
  amount: number;
  created_at: string;
}

export const ADJUSTMENT_REASONS = [
  { value: 'detention', label: 'Detention' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'layover', label: 'Layover' },
  { value: 'late_fee', label: 'Late Fee' },
  { value: 'bank_fee', label: 'Bank Fee' },
  { value: 'weekly_insurance_fee', label: 'Weekly Insurance Fee' },
  { value: 'other', label: 'Others' },
] as const;

export function usePaymentAdjustments(paymentId: string) {
  const [adjustments, setAdjustments] = useState<DbPaymentAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_adjustments')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true });
    if (!error) setAdjustments((data as any) || []);
    setLoading(false);
  }, [paymentId]);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  const addAdjustment = async (adj: {
    adjustment_type: string;
    reason: string;
    description?: string;
    amount: number;
  }) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('payment_adjustments').insert({
      payment_id: paymentId,
      ...adj,
      tenant_id,
    } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Ajuste agregado' });
    fetchAdjustments();
    return true;
  };

  const deleteAdjustment = async (id: string) => {
    const { error } = await supabase.from('payment_adjustments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Ajuste eliminado' });
    fetchAdjustments();
    return true;
  };

  const totalAdjustment = adjustments.reduce((sum, a) => {
    return sum + (a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount));
  }, 0);

  return { adjustments, loading, addAdjustment, deleteAdjustment, totalAdjustment, refetch: fetchAdjustments };
}

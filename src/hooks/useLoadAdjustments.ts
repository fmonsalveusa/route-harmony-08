import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface LoadAdjustment {
  id: string;
  load_id: string;
  adjustment_type: string;
  reason: string;
  description: string | null;
  amount: number;
  apply_to: string[];
  created_at: string;
}

export function useLoadAdjustments(loadId: string) {
  const [adjustments, setAdjustments] = useState<LoadAdjustment[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch load adjustments
    const { data: adjData } = await supabase
      .from('load_adjustments')
      .select('*')
      .eq('load_id', loadId)
      .order('created_at', { ascending: true });

    setAdjustments((adjData as any) || []);

    // Derive available recipients from load's driver, not from payments
    const { data: loadData } = await supabase
      .from('loads')
      .select('driver_id')
      .eq('id', loadId)
      .single();

    const recipients: string[] = [];

    if (loadData?.driver_id) {
      recipients.push('driver');

      // Check if the driver has an investor
      const { data: driverData } = await supabase
        .from('drivers')
        .select('investor_name')
        .eq('id', loadData.driver_id)
        .single();

      if (driverData?.investor_name) {
        recipients.push('investor');
      }
    }

    setAvailableRecipients(recipients);
    setLoading(false);
  }, [loadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addAdjustment = async (adj: {
    adjustment_type: string;
    reason: string;
    description?: string;
    amount: number;
    applyTo: string[];
  }) => {
    const tenant_id = await getTenantId();

    // 1. Insert load adjustment
    const { data: inserted, error } = await supabase
      .from('load_adjustments')
      .insert({
        load_id: loadId,
        adjustment_type: adj.adjustment_type,
        reason: adj.reason,
        description: adj.description || null,
        amount: adj.amount,
        apply_to: adj.applyTo,
        tenant_id,
      })
      .select()
      .single();

    if (error || !inserted) {
      toast({ title: 'Error', description: error?.message || 'Could not create adjustment', variant: 'destructive' });
      return false;
    }

    const loadAdjId = (inserted as any).id;

    // 2. Find payments for the selected recipient types (may not exist yet for in_transit/tonu)
    const { data: payments } = await supabase
      .from('payments')
      .select('id')
      .eq('load_id', loadId)
      .in('recipient_type', adj.applyTo);

    // 3. Propagate to payment_adjustments only if payments exist
    if (payments && payments.length > 0) {
      const payAdjs = payments.map((p: any) => ({
        payment_id: p.id,
        adjustment_type: adj.adjustment_type,
        reason: adj.reason,
        description: adj.description || null,
        amount: adj.amount,
        load_adjustment_id: loadAdjId,
        tenant_id,
      }));

      const { error: paError } = await supabase
        .from('payment_adjustments')
        .insert(payAdjs as any);

      if (paError) {
        console.error('Error propagating adjustments:', paError);
      }
    }

    toast({ title: 'Adjustment added' });
    fetchAll();
    return true;
  };

  const deleteAdjustment = async (id: string) => {
    // payment_adjustments with load_adjustment_id will cascade-delete automatically
    const { error } = await supabase
      .from('load_adjustments')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Adjustment deleted' });
    fetchAll();
    return true;
  };

  return { adjustments, availableRecipients, loading, addAdjustment, deleteAdjustment, refetch: fetchAll };
}

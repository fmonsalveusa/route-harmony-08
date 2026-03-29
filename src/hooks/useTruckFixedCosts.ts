import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbTruckFixedCost {
  id: string;
  truck_id: string;
  description: string;
  amount: number;
  frequency: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedCostInput {
  truck_id: string;
  description: string;
  amount: number;
  frequency: string;
}

const QUERY_KEY = ['truck_fixed_costs'];

async function fetchFixedCosts(): Promise<DbTruckFixedCost[]> {
  const { data, error } = await supabase
    .from('truck_fixed_costs' as any)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any as DbTruckFixedCost[]) ?? [];
}

export function useTruckFixedCosts() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: fixedCosts = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFixedCosts,
  });

  const createFixedCost = useCallback(async (input: FixedCostInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase
      .from('truck_fixed_costs' as any)
      .insert([{ ...input, tenant_id } as any]);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Fixed cost added' });
    return true;
  }, [queryClient]);

  const updateFixedCost = useCallback(async (id: string, input: Partial<FixedCostInput>) => {
    const { error } = await supabase
      .from('truck_fixed_costs' as any)
      .update(input as any)
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Fixed cost updated' });
    return true;
  }, [queryClient]);

  const deleteFixedCost = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('truck_fixed_costs' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Fixed cost deleted' });
    return true;
  }, [queryClient]);

  /** Get monthly equivalent for a truck */
  const getMonthlyFixedCosts = useCallback((truckId: string) => {
    return fixedCosts
      .filter(fc => fc.truck_id === truckId)
      .reduce((sum, fc) => {
        switch (fc.frequency) {
          case 'weekly': return sum + fc.amount * 4.33;
          case 'yearly': return sum + fc.amount / 12;
          default: return sum + fc.amount; // monthly
        }
      }, 0);
  }, [fixedCosts]);

  /** Get period-adjusted fixed costs */
  const getPeriodFixedCosts = useCallback((truckId: string, period: 'week' | 'month' | 'year') => {
    const monthly = getMonthlyFixedCosts(truckId);
    switch (period) {
      case 'week': return monthly / 4.33;
      case 'year': return monthly * 12;
      default: return monthly;
    }
  }, [getMonthlyFixedCosts]);

  return { fixedCosts, loading, createFixedCost, updateFixedCost, deleteFixedCost, getMonthlyFixedCosts, getPeriodFixedCosts };
}

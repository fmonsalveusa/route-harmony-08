import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbTruckVariableCost {
  id: string;
  truck_id: string;
  description: string;
  cost_per_mile: number;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VariableCostInput {
  truck_id: string;
  description: string;
  cost_per_mile: number;
}

const QUERY_KEY = ['truck_variable_costs'];

async function fetchVariableCosts(): Promise<DbTruckVariableCost[]> {
  const { data, error } = await supabase
    .from('truck_variable_costs' as any)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any as DbTruckVariableCost[]) ?? [];
}

export function useTruckVariableCosts() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: variableCosts = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchVariableCosts,
  });

  const createVariableCost = useCallback(async (input: VariableCostInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase
      .from('truck_variable_costs' as any)
      .insert([{ ...input, tenant_id } as any]);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Variable cost added' });
    return true;
  }, [queryClient]);

  const updateVariableCost = useCallback(async (id: string, input: Partial<VariableCostInput>) => {
    const { error } = await supabase
      .from('truck_variable_costs' as any)
      .update(input as any)
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Variable cost updated' });
    return true;
  }, [queryClient]);

  const deleteVariableCost = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('truck_variable_costs' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Variable cost deleted' });
    return true;
  }, [queryClient]);

  /** Sum of all per-mile costs for a truck */
  const getCostPerMile = useCallback((truckId: string) => {
    return variableCosts
      .filter(vc => vc.truck_id === truckId)
      .reduce((sum, vc) => sum + Number(vc.cost_per_mile || 0), 0);
  }, [variableCosts]);

  return { variableCosts, loading, createVariableCost, updateVariableCost, deleteVariableCost, getCostPerMile };
}

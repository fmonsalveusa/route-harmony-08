import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbRecurringDeduction {
  id: string;
  recipient_id: string;
  recipient_type: string;
  recipient_name: string;
  description: string;
  amount: number;
  frequency: string;
  reason: string;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringDeductionInput {
  recipient_id: string;
  recipient_type: string;
  recipient_name: string;
  description: string;
  amount: number;
  frequency: string;
  reason: string;
  is_active?: boolean;
}

const QUERY_KEY = ['recurring_deductions'];

async function fetchRecurringDeductions(): Promise<DbRecurringDeduction[]> {
  const { data, error } = await supabase
    .from('recurring_deductions' as any)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any as DbRecurringDeduction[]) ?? [];
}

export function useRecurringDeductions() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: deductions = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRecurringDeductions,
  });

  const createDeduction = useCallback(async (input: RecurringDeductionInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase
      .from('recurring_deductions' as any)
      .insert([{ ...input, tenant_id } as any]);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Recurring deduction added' });
    return true;
  }, [queryClient]);

  const updateDeduction = useCallback(async (id: string, input: Partial<RecurringDeductionInput>) => {
    const { error } = await supabase
      .from('recurring_deductions' as any)
      .update(input as any)
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Recurring deduction updated' });
    return true;
  }, [queryClient]);

  const deleteDeduction = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('recurring_deductions' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Recurring deduction deleted' });
    return true;
  }, [queryClient]);

  const toggleActive = useCallback(async (id: string, is_active: boolean) => {
    return updateDeduction(id, { is_active });
  }, [updateDeduction]);

  return { deductions, loading, createDeduction, updateDeduction, deleteDeduction, toggleActive };
}

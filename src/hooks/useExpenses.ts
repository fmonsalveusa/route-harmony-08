import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbExpense {
  id: string;
  tenant_id: string | null;
  expense_date: string;
  truck_id: string | null;
  driver_name: string | null;
  driver_service_type: string | null;
  expense_type: string;
  category: string | null;
  description: string;
  amount: number;
  tax_amount: number | null;
  total_amount: number;
  payment_method: string;
  vendor: string | null;
  location: string | null;
  odometer_reading: number | null;
  invoice_number: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseInput {
  expense_date: string;
  truck_id?: string | null;
  driver_name?: string | null;
  driver_service_type?: string | null;
  expense_type: string;
  category?: string | null;
  description: string;
  amount: number;
  tax_amount?: number | null;
  payment_method: string;
  vendor?: string | null;
  location?: string | null;
  odometer_reading?: number | null;
  invoice_number?: string | null;
  notes?: string | null;
  source?: string;
}

const EXPENSES_QUERY_KEY = ['expenses'];

async function fetchExpensesFromDb(): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from('expenses' as any)
    .select('*')
    .order('expense_date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
  return (data as any as DbExpense[]) ?? [];
}

export function useExpenses() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading: loading } = useQuery({
    queryKey: EXPENSES_QUERY_KEY,
    queryFn: fetchExpensesFromDb,
  });

  const fetchExpenses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY });
  }, [queryClient]);

  const createExpense = useCallback(async (input: CreateExpenseInput) => {
    const tenant_id = await getTenantId();
    const { data, error } = await supabase
      .from('expenses' as any)
      .insert([{ ...input, tenant_id } as any])
      .select()
      .single();

    if (error) {
      console.error('Error creating expense:', error);
      toastRef.current({ title: 'Error', description: 'Failed to create expense', variant: 'destructive' });
      return null;
    }

    queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY });
    toastRef.current({ title: 'Expense added successfully' });
    return data as any as DbExpense;
  }, [queryClient]);

  const createExpensesBatch = useCallback(async (inputs: CreateExpenseInput[]) => {
    const tenant_id = await getTenantId();
    const rows = inputs.map(input => ({ ...input, tenant_id }));
    const { error } = await supabase
      .from('expenses' as any)
      .insert(rows as any);

    if (error) {
      console.error('Error creating expenses batch:', error);
      toastRef.current({ title: 'Error', description: 'Failed to import expenses', variant: 'destructive' });
      return false;
    }

    queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY });
    toastRef.current({ title: `${inputs.length} expenses imported successfully` });
    return true;
  }, [queryClient]);

  const updateExpense = useCallback(async (id: string, input: Partial<CreateExpenseInput>) => {
    const { error } = await supabase
      .from('expenses' as any)
      .update(input as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating expense:', error);
      toastRef.current({ title: 'Error', description: 'Failed to update expense', variant: 'destructive' });
      return false;
    }

    toastRef.current({ title: 'Expense updated' });
    await queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY });
    return true;
  }, [queryClient]);

  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('expenses' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting expense:', error);
      toastRef.current({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' });
      return false;
    }

    queryClient.setQueryData<DbExpense[]>(EXPENSES_QUERY_KEY, (old) => (old ?? []).filter(e => e.id !== id));
    toastRef.current({ title: 'Expense deleted' });
    return true;
  }, [queryClient]);

  const deleteExpensesBatch = useCallback(async (ids: string[]) => {
    const { error } = await supabase
      .from('expenses' as any)
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting expenses:', error);
      toastRef.current({ title: 'Error', description: 'Failed to delete expenses', variant: 'destructive' });
      return false;
    }

    queryClient.setQueryData<DbExpense[]>(EXPENSES_QUERY_KEY, (old) => (old ?? []).filter(e => !ids.includes(e.id)));
    toastRef.current({ title: `${ids.length} expenses deleted` });
    return true;
  }, [queryClient]);

  return { expenses, loading, fetchExpenses, createExpense, createExpensesBatch, updateExpense, deleteExpense, deleteExpensesBatch };
}

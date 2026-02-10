import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbLoad {
  id: string;
  reference_number: string;
  origin: string;
  destination: string;
  pickup_date: string | null;
  delivery_date: string | null;
  weight: number;
  cargo_type: string | null;
  total_rate: number;
  status: string;
  driver_id: string | null;
  truck_id: string | null;
  dispatcher_id: string | null;
  broker_client: string | null;
  driver_pay_amount: number;
  investor_pay_amount: number;
  dispatcher_pay_amount: number;
  company_profit: number;
  miles: number;
  factoring: string | null;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  route_geometry: any;
}

export interface CreateLoadInput {
  reference_number: string;
  origin: string;
  destination: string;
  pickup_date?: string;
  delivery_date?: string;
  weight?: number;
  cargo_type?: string;
  total_rate: number;
  driver_id?: string;
  truck_id?: string;
  dispatcher_id?: string;
  broker_client?: string;
  driver_pay_amount?: number;
  investor_pay_amount?: number;
  dispatcher_pay_amount?: number;
  company_profit?: number;
  miles?: number;
  factoring?: string;
  pdf_url?: string;
  notes?: string;
}

const LOADS_QUERY_KEY = ['loads'];

async function fetchLoadsFromDb(): Promise<DbLoad[]> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .order('pickup_date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching loads:', error);
    throw error;
  }
  return (data as DbLoad[]) ?? [];
}

export function useLoads() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: loads = [], isLoading: loading } = useQuery({
    queryKey: LOADS_QUERY_KEY,
    queryFn: fetchLoadsFromDb,
  });

  const fetchLoads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: LOADS_QUERY_KEY });
  }, [queryClient]);

  const createLoad = useCallback(async (input: CreateLoadInput) => {
    const tenant_id = await getTenantId();

    // Check for duplicate reference number
    const { data: existing } = await supabase
      .from('loads')
      .select('id')
      .eq('reference_number', input.reference_number)
      .maybeSingle();

    if (existing) {
      toastRef.current({ title: 'Carga duplicada', description: `Ya existe una carga con referencia: ${input.reference_number}`, variant: 'destructive' });
      return null;
    }

    const { data, error } = await supabase
      .from('loads')
      .insert([{ ...input, tenant_id } as any])
      .select()
      .single();

    if (error) {
      console.error('Error creating load:', error);
      toastRef.current({ title: 'Error', description: 'Failed to create load', variant: 'destructive' });
      return null;
    }

    const newLoad = data as DbLoad;
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => [newLoad, ...(old ?? [])]);

    toastRef.current({ title: 'Load created', description: `Reference: ${input.reference_number}` });
    return newLoad;
  }, [queryClient]);

  const updateLoad = useCallback(async (id: string, input: Partial<CreateLoadInput> & { status?: string }) => {
    const { error } = await supabase
      .from('loads')
      .update(input as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating load:', error);
      toastRef.current({ title: 'Error', description: 'Failed to update load', variant: 'destructive' });
      return false;
    }

    toastRef.current({ title: 'Load updated' });
    await queryClient.invalidateQueries({ queryKey: LOADS_QUERY_KEY });
    return true;
  }, [queryClient]);

  const deleteLoad = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('loads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting load:', error);
      toastRef.current({ title: 'Error', description: 'Failed to delete load', variant: 'destructive' });
      return false;
    }

    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => (old ?? []).filter(l => l.id !== id));
    toastRef.current({ title: 'Load deleted' });
    return true;
  }, [queryClient]);

  const createLoadsBulk = useCallback(async (inputs: CreateLoadInput[]): Promise<{ success: number; errors: number }> => {
    const tenant_id = await getTenantId();
    const BATCH_SIZE = 50;
    let success = 0;
    let errors = 0;

    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE).map(input => ({ ...input, tenant_id } as any));
      const { data, error } = await supabase.from('loads').insert(batch).select();
      if (error) {
        console.error('Batch insert error:', error);
        errors += batch.length;
      } else {
        success += data?.length ?? 0;
      }
    }

    await queryClient.invalidateQueries({ queryKey: LOADS_QUERY_KEY });

    if (success > 0) {
      toastRef.current({ title: 'Bulk import complete', description: `${success} loads imported${errors > 0 ? `, ${errors} failed` : ''}` });
    }

    return { success, errors };
  }, [queryClient]);

  return { loads, loading, fetchLoads, createLoad, updateLoad, deleteLoad, createLoadsBulk };
}

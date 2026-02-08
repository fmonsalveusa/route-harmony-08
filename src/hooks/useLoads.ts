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
    .order('created_at', { ascending: false });

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
    const { data, error } = await supabase
      .from('loads')
      .insert([{ ...input, tenant_id } as any])
      .select()
      .single();

    if (error) {
      console.error('Error creating load:', error);
      toastRef.current({ title: 'Error', description: 'No se pudo crear la carga', variant: 'destructive' });
      return null;
    }

    const newLoad = data as DbLoad;
    // Update cache immediately with the new load
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => [newLoad, ...(old ?? [])]);

    toastRef.current({ title: 'Carga creada', description: `Referencia: ${input.reference_number}` });
    return newLoad;
  }, [queryClient]);

  const updateLoad = useCallback(async (id: string, input: Partial<CreateLoadInput> & { status?: string }) => {
    const { error } = await supabase
      .from('loads')
      .update(input as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating load:', error);
      toastRef.current({ title: 'Error', description: 'No se pudo actualizar la carga', variant: 'destructive' });
      return false;
    }

    toastRef.current({ title: 'Carga actualizada' });
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
      toastRef.current({ title: 'Error', description: 'No se pudo eliminar la carga', variant: 'destructive' });
      return false;
    }

    // Remove from cache immediately
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => (old ?? []).filter(l => l.id !== id));
    toastRef.current({ title: 'Carga eliminada' });
    return true;
  }, [queryClient]);

  return { loads, loading, fetchLoads, createLoad, updateLoad, deleteLoad };
}

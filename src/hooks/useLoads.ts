import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useLoads() {
  const [loads, setLoads] = useState<DbLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const fetchLoads = useCallback(async () => {
    const { data, error } = await supabase
      .from('loads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loads:', error);
      toastRef.current({ title: 'Error', description: 'No se pudieron cargar las cargas', variant: 'destructive' });
    } else {
      setLoads((data as DbLoad[]) || []);
    }
    setLoading(false);
  }, []);

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

    toastRef.current({ title: 'Carga creada', description: `Referencia: ${input.reference_number}` });
    return data as DbLoad;
  }, []);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

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
    await fetchLoads();
    return true;
  }, [fetchLoads]);

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

    toastRef.current({ title: 'Carga eliminada' });
    await fetchLoads();
    return true;
  }, [fetchLoads]);

  return { loads, loading, fetchLoads, createLoad, updateLoad, deleteLoad };
}

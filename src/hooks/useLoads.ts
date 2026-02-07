import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  dispatcher_id?: string;
  broker_client?: string;
  driver_pay_amount?: number;
  investor_pay_amount?: number;
  dispatcher_pay_amount?: number;
  company_profit?: number;
}

export function useLoads() {
  const [loads, setLoads] = useState<DbLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loads:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las cargas', variant: 'destructive' });
    } else {
      setLoads((data as DbLoad[]) || []);
    }
    setLoading(false);
  }, [toast]);

  const createLoad = useCallback(async (input: CreateLoadInput) => {
    const { data, error } = await supabase
      .from('loads')
      .insert([input as any])
      .select()
      .single();

    if (error) {
      console.error('Error creating load:', error);
      toast({ title: 'Error', description: 'No se pudo crear la carga', variant: 'destructive' });
      return null;
    }

    toast({ title: 'Carga creada', description: `Referencia: ${input.reference_number}` });
    await fetchLoads();
    return data as DbLoad;
  }, [fetchLoads, toast]);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  return { loads, loading, fetchLoads, createLoad };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DbDispatcher {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  commission_percentage: number;
  dispatch_service_percentage: number;
  pay_type: string;
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface DispatcherInput {
  name: string;
  email: string;
  phone: string;
  status: string;
  commission_percentage: number;
  dispatch_service_percentage: number;
  pay_type: string;
  start_date: string;
}

export function useDispatchers() {
  const [dispatchers, setDispatchers] = useState<DbDispatcher[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDispatchers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('dispatchers' as any).select('*').order('name');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDispatchers((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDispatchers(); }, [fetchDispatchers]);

  const createDispatcher = async (input: DispatcherInput) => {
    const { error } = await supabase.from('dispatchers' as any).insert(input as any);
    if (error) {
      toast({ title: 'Error al crear dispatcher', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Dispatcher creado exitosamente' });
    fetchDispatchers();
    return true;
  };

  const updateDispatcher = async (id: string, input: Partial<DispatcherInput>) => {
    const { error } = await supabase.from('dispatchers' as any).update(input as any).eq('id', id);
    if (error) {
      toast({ title: 'Error al actualizar dispatcher', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Dispatcher actualizado exitosamente' });
    fetchDispatchers();
    return true;
  };

  const deleteDispatcher = async (id: string) => {
    const { error } = await supabase.from('dispatchers' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error al eliminar dispatcher', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Dispatcher eliminado exitosamente' });
    fetchDispatchers();
    return true;
  };

  return { dispatchers, loading, createDispatcher, updateDispatcher, deleteDispatcher, refetch: fetchDispatchers };
}

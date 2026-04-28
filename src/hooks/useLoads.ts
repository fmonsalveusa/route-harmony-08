import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  route_geometry?: any; // solo se usa en LoadDetailPanel, no en la lista
  empty_miles: number;
  empty_miles_origin: string | null;
  company_id: string | null;
  gross_rate?: number | null;
  rc_original_url?: string | null;
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
  company_id?: string;
  gross_rate?: number | null;
  rc_original_url?: string | null;
}

const LOADS_QUERY_KEY = ['loads'];

// Columnas explícitas — excluye route_geometry que es pesado y no se necesita en la lista
const LOADS_SELECT = [
  'id', 'reference_number', 'origin', 'destination', 'pickup_date', 'delivery_date',
  'weight', 'cargo_type', 'total_rate', 'status', 'driver_id', 'truck_id',
  'dispatcher_id', 'broker_client', 'driver_pay_amount', 'investor_pay_amount',
  'dispatcher_pay_amount', 'company_profit', 'miles', 'factoring', 'pdf_url',
  'notes', 'created_at', 'empty_miles', 'empty_miles_origin', 'company_id',
  'gross_rate', 'rc_original_url'
].join(',');

async function fetchLoadsFromDb(): Promise<DbLoad[]> {
  const { data, error } = await supabase
    .from('loads')
    .select(LOADS_SELECT)
    .order('pickup_date', { ascending: false, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching loads:', error);
    throw error;
  }
  return ((data as unknown) as DbLoad[]) ?? [];
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

  // Realtime: actualiza cache local en vez de refetchear todo
  useEffect(() => {
    const channel = supabase
      .channel('loads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loads' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => {
            if (!old) return old;

            if (eventType === 'INSERT') {
              // Nueva carga — agregar al inicio si no existe ya
              const exists = old.some(l => l.id === (newRecord as any).id);
              if (exists) return old;
              return [newRecord as DbLoad, ...old];
            }

            if (eventType === 'UPDATE') {
              // Actualizar solo la carga que cambió
              return old.map(l =>
                l.id === (newRecord as any).id ? { ...l, ...(newRecord as DbLoad) } : l
              );
            }

            if (eventType === 'DELETE') {
              // Eliminar del cache
              return old.filter(l => l.id !== (oldRecord as any).id);
            }

            return old;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Solo en caso de error del canal, refetchear
          queryClient.invalidateQueries({ queryKey: LOADS_QUERY_KEY });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fetchLoads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: LOADS_QUERY_KEY });
  }, [queryClient]);

  const createLoad = useCallback(async (input: CreateLoadInput) => {
    const tenant_id = await getTenantId();

    // Verificar duplicado
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
      .select(LOADS_SELECT)
      .single();

    if (error) {
      console.error('Error creating load:', error);
      toastRef.current({ title: 'Error', description: 'Failed to create load', variant: 'destructive' });
      return null;
    }

    const newLoad = (data as unknown) as DbLoad;
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) => [newLoad, ...(old ?? [])]);
    queryClient.invalidateQueries({ queryKey: ['weekly-rates-chart'] }); // refresca gráfica
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
      toastRef.current({ title: 'Error al guardar', description: error.message || 'Failed to update load', variant: 'destructive' });
      return false;
    }

    // Actualizar cache local inmediatamente
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) =>
      (old ?? []).map(l => l.id === id ? { ...l, ...input } : l)
    );
    toastRef.current({ title: 'Load updated' });
    return true;
  }, [queryClient]);

  /**
   * Silent update para millas/route_geometry calculadas automáticamente.
   * No muestra toast — el usuario no lo disparó.
   */
  const updateLoadMiles = useCallback(async (id: string, miles: number, routeGeometry?: any) => {
    const payload: any = { miles };
    if (routeGeometry) payload.route_geometry = routeGeometry;

    const { error } = await supabase.from('loads').update(payload).eq('id', id);
    if (error) {
      console.error('Error saving miles:', error);
      return;
    }

    // Actualizar cache local — no incluir route_geometry en la lista
    queryClient.setQueryData<DbLoad[]>(LOADS_QUERY_KEY, (old) =>
      (old ?? []).map(l => l.id === id ? { ...l, miles } : l)
    );
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
      const { data, error } = await supabase.from('loads').insert(batch).select(LOADS_SELECT);
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

  return { loads, loading, fetchLoads, createLoad, updateLoad, updateLoadMiles, deleteLoad, createLoadsBulk };
}

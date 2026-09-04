import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

export interface LoadStop {
  id: string;
  load_id: string;
  stop_type: 'pickup' | 'delivery';
  address: string;
  stop_order: number;
  date: string | null;
  lat: number | null;
  lng: number | null;
  distance_from_prev: number | null;
  created_at: string;
}

export interface CreateStopInput {
  load_id: string;
  stop_type: 'pickup' | 'delivery';
  address: string;
  stop_order: number;
  date?: string;
}

const stopsQueryKey = (loadId: string) => ['load_stops', loadId];

async function fetchStopsFromDb(loadId: string): Promise<LoadStop[]> {
  const { data, error } = await supabase
    .from('load_stops')
    .select('*')
    .eq('load_id', loadId)
    .order('stop_order', { ascending: true });

  if (error) {
    console.error('Error fetching load stops:', error);
    throw error;
  }
  return (data as LoadStop[]) ?? [];
}

export function useLoadStops(loadId?: string) {
  const queryClient = useQueryClient();

  const { data: stops = [], isLoading: loading } = useQuery({
    queryKey: stopsQueryKey(loadId ?? ''),
    queryFn: () => fetchStopsFromDb(loadId!),
    // Solo ejecuta si hay un loadId válido
    enabled: !!loadId,
    // Stops no cambian frecuentemente — caché de 5 minutos evita
    // refetches innecesarios al abrir y cerrar el mismo detalle
    staleTime: 5 * 60 * 1000,
  });

  const fetchStops = useCallback(async (id?: string) => {
    const targetId = id || loadId;
    if (!targetId) return [];
    const data = await queryClient.fetchQuery({
      queryKey: stopsQueryKey(targetId),
      queryFn: () => fetchStopsFromDb(targetId),
    });
    return data;
  }, [loadId, queryClient]);

  const saveStops = useCallback(async (targetLoadId: string, newStops: Omit<CreateStopInput, 'load_id'>[]) => {
    // Guardar mapping de stop_order → stop data antes de borrar
    const { data: existingData } = await supabase
      .from('load_stops')
      .select('id, stop_order, photos')
      .eq('load_id', targetLoadId);

    const existingByOrder = new Map<number, { id: string; photos: any }>(
      ((existingData as any[]) || []).map((s: any) => [
        s.stop_order as number,
        { id: s.id, photos: s.photos }
      ])
    );

    await supabase.from('load_stops').delete().eq('load_id', targetLoadId);

    if (newStops.length > 0) {
      const tenant_id = await getTenantId();
      const inserts = newStops.map((s, i) => {
        const order = s.stop_order ?? i;
        const existing = existingByOrder.get(order);
        return {
          load_id: targetLoadId,
          stop_type: s.stop_type,
          address: s.address,
          stop_order: order,
          date: s.date || null,
          shipper: (s as any).shipper || null,
          consignee: (s as any).consignee || null,
          time: (s as any).time || null,
          tenant_id,
          ...(existing?.photos ? { photos: existing.photos } : {}),
        };
      });

      const { data: insertedStops, error } = await supabase
        .from('load_stops')
        .insert(inserts)
        .select('id, stop_order');

      if (error) {
        console.error('Error saving load stops:', error);
      } else if (insertedStops) {
        // Migrar pod_documents a los nuevos stop_ids por stop_order
        for (const newStop of insertedStops as any[]) {
          const oldStop = existingByOrder.get(newStop.stop_order);
          if (oldStop?.id && oldStop.id !== newStop.id) {
            await supabase
              .from('pod_documents' as any)
              .update({ stop_id: newStop.id } as any)
              .eq('stop_id', oldStop.id);
          }
        }
      }
    }

    await queryClient.invalidateQueries({ queryKey: stopsQueryKey(targetLoadId) });
  }, [queryClient]);

  const updateStopGeodata = useCallback(async (
    stopId: string,
    lat: number,
    lng: number,
    distanceFromPrev?: number
  ) => {
    const updateData: any = { lat, lng };
    if (distanceFromPrev !== undefined) updateData.distance_from_prev = distanceFromPrev;
    await supabase.from('load_stops').update(updateData).eq('id', stopId);

    // Invalidar caché del load correspondiente
    if (loadId) {
      await queryClient.invalidateQueries({ queryKey: stopsQueryKey(loadId) });
    }
  }, [loadId, queryClient]);

  return { stops, loading, fetchStops, saveStops, updateStopGeodata };
}

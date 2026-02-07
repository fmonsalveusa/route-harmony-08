import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LoadStop {
  id: string;
  load_id: string;
  stop_type: 'pickup' | 'delivery';
  address: string;
  stop_order: number;
  date: string | null;
  created_at: string;
}

export interface CreateStopInput {
  load_id: string;
  stop_type: 'pickup' | 'delivery';
  address: string;
  stop_order: number;
  date?: string;
}

export function useLoadStops(loadId?: string) {
  const [stops, setStops] = useState<LoadStop[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStops = useCallback(async (id?: string) => {
    const targetId = id || loadId;
    if (!targetId) return [];
    setLoading(true);
    const { data, error } = await supabase
      .from('load_stops')
      .select('*')
      .eq('load_id', targetId)
      .order('stop_order', { ascending: true });

    if (error) {
      console.error('Error fetching load stops:', error);
      setLoading(false);
      return [];
    }
    const result = (data as LoadStop[]) || [];
    setStops(result);
    setLoading(false);
    return result;
  }, [loadId]);

  const saveStops = useCallback(async (loadId: string, newStops: Omit<CreateStopInput, 'load_id'>[]) => {
    // Delete existing stops for this load
    await supabase.from('load_stops').delete().eq('load_id', loadId);

    if (newStops.length === 0) return;

    const inserts = newStops.map((s, i) => ({
      load_id: loadId,
      stop_type: s.stop_type,
      address: s.address,
      stop_order: s.stop_order ?? i,
      date: s.date || null,
    }));

    const { error } = await supabase.from('load_stops').insert(inserts);
    if (error) {
      console.error('Error saving load stops:', error);
    }
  }, []);

  useEffect(() => {
    if (loadId) fetchStops();
  }, [loadId, fetchStops]);

  return { stops, loading, fetchStops, saveStops };
}

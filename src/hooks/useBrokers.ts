import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Broker {
  id: string;
  name: string;
  mc_number: string | null;
  dot_number: string | null;
  address: string | null;
  rating: string | null;
  days_to_pay: number | null;
  notes: string | null;
  loads_count: number;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['brokers'];

export function useBrokers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brokers = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Broker[]> => {
      const { data, error } = await supabase
        .from('brokers' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const updateBroker = useMutation({
    mutationFn: async (input: { id: string; mc_number?: string | null; dot_number?: string | null; address?: string | null; rating?: string | null; days_to_pay?: number | null; notes?: string | null }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('brokers' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'Broker actualizado' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar el broker', variant: 'destructive' });
    },
  });

  return { brokers, isLoading, updateBroker };
}

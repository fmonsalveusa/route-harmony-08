import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BrokerCreditScore {
  id: string;
  name: string;
  score: number | null;
  days_to_pay: number | null;
  rating: string | null;
  notes: string | null;
  mc_number: string | null;
  updated_at: string;
  created_at: string;
  // Map old field names for compatibility
  broker_name: string;
}

const QUERY_KEY = ['brokers'];

export function useBrokerScores() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scores = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, 'scores'],
    queryFn: async (): Promise<BrokerCreditScore[]> => {
      const { data, error } = await supabase
        .from('brokers' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return ((data as any[]) ?? []).map((b: any) => ({
        ...b,
        broker_name: b.name,
        score: null,
      }));
    },
  });

  const getScoreForBroker = (brokerName: string | null | undefined): BrokerCreditScore | undefined => {
    if (!brokerName) return undefined;
    const lower = brokerName.toLowerCase().trim();
    return scores.find(s => s.name.toLowerCase().trim() === lower);
  };

  const upsertScore = useMutation({
    mutationFn: async (input: { broker_name: string; score?: number; days_to_pay?: number; rating?: string; notes?: string }) => {
      const { broker_name, score, ...rest } = input;
      // Upsert into brokers table by name
      const { data, error } = await supabase
        .from('brokers' as any)
        .upsert(
          { name: broker_name.trim(), ...rest, updated_at: new Date().toISOString() } as any,
          { onConflict: 'name' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'RTS Score guardado' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo guardar el score', variant: 'destructive' });
    },
  });

  return { scores, isLoading, getScoreForBroker, upsertScore };
}

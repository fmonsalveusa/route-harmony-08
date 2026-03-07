import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { useToast } from '@/hooks/use-toast';

export interface BrokerCreditScore {
  id: string;
  broker_name: string;
  score: number | null;
  days_to_pay: number | null;
  rating: string | null;
  notes: string | null;
  mc_number: string | null;
  tenant_id: string | null;
  updated_at: string;
  created_at: string;
}

const QUERY_KEY = ['broker_credit_scores'];

export function useBrokerScores() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scores = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<BrokerCreditScore[]> => {
      const { data, error } = await supabase
        .from('broker_credit_scores' as any)
        .select('*')
        .order('broker_name');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const getScoreForBroker = (brokerName: string | null | undefined): BrokerCreditScore | undefined => {
    if (!brokerName) return undefined;
    const lower = brokerName.toLowerCase().trim();
    return scores.find(s => s.broker_name.toLowerCase().trim() === lower);
  };

  const upsertScore = useMutation({
    mutationFn: async (input: { broker_name: string; score: number; days_to_pay?: number; rating?: string; notes?: string }) => {
      const tenant_id = await getTenantId();
      const { data, error } = await supabase
        .from('broker_credit_scores' as any)
        .upsert(
          { ...input, tenant_id, updated_at: new Date().toISOString() } as any,
          { onConflict: 'broker_name,tenant_id' }
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

  const lookupMc = useMutation({
    mutationFn: async (broker_name: string) => {
      const { data, error } = await supabase.functions.invoke('lookup-broker-mc', {
        body: { broker_name },
      });
      if (error) throw error;
      return data as { mc_number: string | null; dot_number: string | null; legal_name: string | null };
    },
    onSuccess: async (data, broker_name) => {
      if (data.mc_number) {
        const tenant_id = await getTenantId();
        await supabase
          .from('broker_credit_scores' as any)
          .update({ mc_number: data.mc_number } as any)
          .eq('broker_name', broker_name.trim())
          .eq('tenant_id', tenant_id);
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
    },
    onError: (err) => {
      console.error('MC lookup failed:', err);
    },
  });

  return { scores, isLoading, getScoreForBroker, upsertScore, lookupMc };
}

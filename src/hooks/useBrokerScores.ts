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
      const FMCSA_KEY = '5a7edc58509eaada5f5777a2b83b3abc68355b0b';
      const encoded = encodeURIComponent(broker_name.trim());
      const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/name/${encoded}?webKey=${FMCSA_KEY}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        console.error('FMCSA API error:', res.status, body);
        return { mc_number: null, dot_number: null, legal_name: null };
      }
      
      const fmcsaData = await res.json();
      const carriers = fmcsaData?.content;
      if (!carriers || !Array.isArray(carriers) || carriers.length === 0) {
        return { mc_number: null, dot_number: null, legal_name: null };
      }
      
      const first = carriers[0]?.carrier || carriers[0];
      const mcNumber = first.mcNumber || first.mc_number || first.mcNum || null;
      const dotNumber = first.dotNumber || first.dot_number || first.dotNum || null;
      const legalName = first.legalName || first.legal_name || null;
      
      return {
        mc_number: mcNumber ? String(mcNumber) : null,
        dot_number: dotNumber ? String(dotNumber) : null,
        legal_name: legalName,
      };
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

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DriverPayment {
  id: string;
  load_id: string;
  load_reference: string;
  amount: number;
  percentage_applied: number;
  total_rate: number;
  status: string;
  payment_date: string | null;
  created_at: string;
  origin?: string;
  destination?: string;
  net_amount?: number;
  total_adjustments?: number;
}

export function useDriverPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!profile?.email) return;
    setLoading(true);

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('email', profile.email)
      .maybeSingle();

    if (!driver) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('recipient_id', driver.id)
      .eq('recipient_type', 'driver')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const loadIds = [...new Set((data as any[]).map(p => p.load_id))];
      
      // Fetch loads for origin/destination
      const { data: loads } = await supabase
        .from('loads')
        .select('id, origin, destination')
        .in('id', loadIds);
      
      const loadMap = new Map((loads || []).map((l: any) => [l.id, l]));

      // Fetch payment adjustments
      const paymentIds = (data as any[]).map(p => p.id);
      const { data: adjustments } = await supabase
        .from('payment_adjustments')
        .select('*')
        .in('payment_id', paymentIds);

      const adjMap = new Map<string, number>();
      for (const adj of (adjustments || []) as any[]) {
        const current = adjMap.get(adj.payment_id) || 0;
        const val = adj.adjustment_type === 'addition' ? adj.amount : -adj.amount;
        adjMap.set(adj.payment_id, current + val);
      }

      const enriched: DriverPayment[] = (data as any[]).map(p => {
        const load = loadMap.get(p.load_id);
        const totalAdj = adjMap.get(p.id) || 0;
        return {
          ...p,
          origin: load?.origin || '',
          destination: load?.destination || '',
          total_adjustments: totalAdj,
          net_amount: p.amount + totalAdj,
        };
      });

      setPayments(enriched);
    }
    setLoading(false);
  }, [profile?.email]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  return { payments, loading, totalPending, totalPaid, refetch: fetchPayments };
}

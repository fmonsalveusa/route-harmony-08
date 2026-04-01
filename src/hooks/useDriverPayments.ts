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
  recipient_name?: string;
  driver_name?: string;
}

async function enrichPayments(data: any[]): Promise<DriverPayment[]> {
  if (!data.length) return [];

  const loadIds = [...new Set(data.map(p => p.load_id))];
  const paymentIds = data.map(p => p.id);

  const [{ data: loads }, { data: adjustments }] = await Promise.all([
    supabase.from('loads').select('id, origin, destination').in('id', loadIds),
    supabase.from('payment_adjustments').select('*').in('payment_id', paymentIds),
  ]);

  const loadMap = new Map((loads || []).map((l: any) => [l.id, l]));
  const adjMap = new Map<string, number>();
  for (const adj of (adjustments || []) as any[]) {
    const current = adjMap.get(adj.payment_id) || 0;
    const val = adj.adjustment_type === 'addition' ? adj.amount : -adj.amount;
    adjMap.set(adj.payment_id, current + val);
  }

  return data.map(p => {
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
}

export function useDriverPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [investorPayments, setInvestorPayments] = useState<DriverPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!profile?.email) return;
    setLoading(true);

    // 1. Find driver by email (for driver payments)
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('email', profile.email)
      .maybeSingle();

    // 2. Find drivers where this user is investor (investor_email match)
    const { data: investorDrivers } = await (supabase
      .from('drivers') as any)
      .select('id, name')
      .eq('investor_email', profile.email);

    // Fetch driver payments
    if (driver) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('recipient_id', driver.id)
        .eq('recipient_type', 'driver')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPayments(await enrichPayments(data as any[]));
      }
    }

    // Fetch investor payments
    if (investorDrivers && investorDrivers.length > 0) {
      const driverIds = investorDrivers.map(d => d.id);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .in('recipient_id', driverIds)
        .eq('recipient_type', 'investor')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInvestorPayments(await enrichPayments(data as any[]));
      }
    } else {
      setInvestorPayments([]);
    }

    setLoading(false);
  }, [profile?.email]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  const investorTotalPending = investorPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);
  const investorTotalPaid = investorPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  return {
    payments, investorPayments, loading,
    totalPending, totalPaid,
    investorTotalPending, investorTotalPaid,
    refetch: fetchPayments,
  };
}

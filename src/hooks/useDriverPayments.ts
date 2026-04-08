import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface DriverPaymentsResult {
  payments: DriverPayment[];
  investorPayments: DriverPayment[];
}

async function enrichPayments(data: any[]): Promise<DriverPayment[]> {
  if (!data.length) return [];

  const loadIds = [...new Set(data.map(p => p.load_id))];
  const paymentIds = data.map(p => p.id);

  // Cargas, ajustes y drivers en paralelo — antes eran secuenciales
  const [{ data: loads }, { data: adjustments }] = await Promise.all([
    supabase.from('loads').select('id, origin, destination, driver_id').in('id', loadIds),
    supabase.from('payment_adjustments').select('*').in('payment_id', paymentIds),
  ]);

  const loadMap = new Map((loads || []).map((l: any) => [l.id, l]));
  const driverIds = [...new Set((loads || []).map((l: any) => l.driver_id).filter(Boolean))];

  const { data: drivers } = driverIds.length
    ? await supabase.from('drivers').select('id, name').in('id', driverIds)
    : { data: [] as any[] };

  const driverMap = new Map((drivers || []).map((d: any) => [d.id, d.name]));

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
      driver_name: load ? driverMap.get(load.driver_id) || '' : '',
      total_adjustments: totalAdj,
      net_amount: p.amount + totalAdj,
    };
  });
}

async function fetchDriverPaymentsFromDb(email: string): Promise<DriverPaymentsResult> {
  // Buscar driver e investor drivers EN PARALELO — antes era secuencial
  const [{ data: driver }, { data: investorDrivers }] = await Promise.all([
    supabase.from('drivers').select('id').eq('email', email).maybeSingle(),
    (supabase.from('drivers') as any).select('id, name').eq('investor_email', email),
  ]);

  // Buscar pagos de driver e investor EN PARALELO
  const [driverPaymentsRaw, investorPaymentsRaw] = await Promise.all([
    driver
      ? supabase
          .from('payments')
          .select('*')
          .eq('recipient_id', driver.id)
          .eq('recipient_type', 'driver')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    investorDrivers && investorDrivers.length > 0
      ? supabase
          .from('payments')
          .select('*')
          .in('recipient_id', investorDrivers.map((d: any) => d.id))
          .eq('recipient_type', 'investor')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Enriquecer pagos con datos de loads y ajustes EN PARALELO
  const [payments, investorPayments] = await Promise.all([
    enrichPayments((driverPaymentsRaw.data as any[]) || []),
    enrichPayments((investorPaymentsRaw.data as any[]) || []),
  ]);

  return { payments, investorPayments };
}

export function useDriverPayments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const email = profile?.email ?? '';

  const { data, isLoading: loading } = useQuery({
    queryKey: ['driver_payments', email],
    queryFn: () => fetchDriverPaymentsFromDb(email),
    enabled: !!email,
  });

  const payments = data?.payments ?? [];
  const investorPayments = data?.investorPayments ?? [];

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['driver_payments', email] });
  }, [queryClient, email]);

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  const investorTotalPending = investorPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  const investorTotalPaid = investorPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.net_amount ?? p.amount), 0);

  return {
    payments, investorPayments, loading,
    totalPending, totalPaid,
    investorTotalPending, investorTotalPaid,
    refetch,
  };
}

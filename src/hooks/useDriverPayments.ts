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

// PostgREST revienta con .in() de cientos de IDs (URL muy larga) → chunks de 100
const CHUNK = 100;

async function selectInChunks(
  ids: string[],
  queryFn: (chunk: string[]) => any,
  label: string
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await queryFn(ids.slice(i, i + CHUNK));
    if (error) {
      console.error(`[useDriverPayments] ${label} error:`, error);
      continue; // seguimos con el resto; peor un dato incompleto que nada
    }
    out.push(...(data || []));
  }
  return out;
}

async function enrichPayments(data: any[]): Promise<DriverPayment[]> {
  if (!data.length) return [];

  const loadIds = [...new Set(data.map(p => p.load_id))];
  const paymentIds = data.map(p => p.id);

  const [loads, adjustments] = await Promise.all([
    selectInChunks(
      loadIds,
      chunk => supabase.from('loads').select('id, origin, destination, driver_id').in('id', chunk),
      'loads'
    ),
    selectInChunks(
      paymentIds,
      chunk => supabase.from('payment_adjustments').select('*').in('payment_id', chunk),
      'payment_adjustments'
    ),
  ]);

  const loadMap = new Map(loads.map((l: any) => [l.id, l]));
  const driverIds = [...new Set(loads.map((l: any) => l.driver_id).filter(Boolean))] as string[];

  const drivers = driverIds.length
    ? await selectInChunks(
        driverIds,
        chunk => supabase.from('drivers').select('id, name').in('id', chunk),
        'drivers'
      )
    : [];

  const driverMap = new Map(drivers.map((d: any) => [d.id, d.name]));

  const adjMap = new Map<string, number>();
  for (const adj of adjustments as any[]) {
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
  // ── Driver: ¿este email es un driver? ──────────────────────────────────
  // ── Investor: ¿este email es un investor? → sus drivers vía driver_investors
  //    (NO usamos drivers.investor_email: es un campo viejo que quedó desactualizado)
  const [{ data: driver }, { data: investor }] = await Promise.all([
    supabase.from('drivers').select('id').ilike('email', email).maybeSingle(),
    supabase.from('investors' as any).select('id, name').ilike('email', email).maybeSingle(),
  ]);

  // Drivers asignados a este investor
  let investorDriverIds: string[] = [];
  const investorName = investor ? (investor as any).name as string : null;

  if (investor && (investor as any).id) {
    const { data: links, error: linksError } = await supabase
      .from('driver_investors' as any)
      .select('driver_id')
      .eq('investor_id', (investor as any).id)
      .eq('is_active', true);
    if (linksError) console.error('[useDriverPayments] driver_investors error:', linksError);
    investorDriverIds = ((links as any) || []).map((l: any) => l.driver_id);
  }

  const [driverPaymentsRaw, investorPaymentsRaw] = await Promise.all([
    driver
      ? supabase
          .from('payments')
          .select('*')
          .eq('recipient_id', driver.id)
          .eq('recipient_type', 'driver')
          .order('created_at', { ascending: false })
          .then(({ data }) => data || [])
      : Promise.resolve([] as any[]),

    // Filtramos por recipient_name además del driver: un driver puede tener 2 investors
    // y sus pagos comparten recipient_id — sin el nombre, cada uno vería los del otro.
    investorDriverIds.length > 0 && investorName
      ? selectInChunks(
          investorDriverIds,
          chunk => supabase
            .from('payments')
            .select('*')
            .in('recipient_id', chunk)
            .eq('recipient_type', 'investor')
            .eq('recipient_name', investorName)
            .order('created_at', { ascending: false }),
          'investor payments'
        )
      : Promise.resolve([] as any[]),
  ]);

  const [payments, investorPayments] = await Promise.all([
    enrichPayments(driverPaymentsRaw as any[]),
    enrichPayments(investorPaymentsRaw as any[]),
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

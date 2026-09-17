import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';
import { todayET } from '@/lib/dateUtils';

export interface DbTruckFixedCost {
  id: string;
  truck_id: string;
  description: string;
  amount: number;
  frequency: string;
  tenant_id: string | null;
  /** Vigente desde (inclusive) */
  effective_from?: string | null;
  /** Vigente hasta (exclusiva). null = vigente hoy */
  effective_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedCostInput {
  truck_id: string;
  description: string;
  amount: number;
  frequency: string;
}

const QUERY_KEY = ['truck_fixed_costs'];

async function fetchFixedCosts(): Promise<DbTruckFixedCost[]> {
  const { data, error } = await supabase
    .from('truck_fixed_costs' as any)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any as DbTruckFixedCost[]) ?? [];
}

const toMonthly = (fc: DbTruckFixedCost) => {
  switch (fc.frequency) {
    case 'weekly': return fc.amount * 4.33;
    case 'yearly': return fc.amount / 12;
    case 'per_mile': return 0;
    default: return fc.amount;
  }
};

const isActiveOn = (fc: DbTruckFixedCost, date: string) =>
  (!fc.effective_from || fc.effective_from <= date) && (!fc.effective_to || date < fc.effective_to);

export function useTruckFixedCosts() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: allCosts = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFixedCosts,
  });

  // Solo las versiones vigentes hoy — lo que se muestra y edita
  const fixedCosts = useMemo(() => allCosts.filter(fc => !fc.effective_to), [allCosts]);

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }), [queryClient]);

  const fail = (message: string) => {
    toastRef.current({ title: 'Error', description: message, variant: 'destructive' });
    return false;
  };

  const createFixedCost = useCallback(async (input: FixedCostInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase
      .from('truck_fixed_costs' as any)
      .insert([{ ...input, tenant_id, effective_from: todayET() } as any]);
    if (error) return fail(error.message);
    await refresh();
    return true;
  }, [refresh]);

  /**
   * Cambia un costo desde hoy. Si la versión vigente empezó hoy se corrige en sitio;
   * si es de antes, se cierra y se crea una versión nueva — las cargas anteriores no cambian.
   */
  const updateFixedCost = useCallback(async (id: string, changes: Partial<FixedCostInput>, silent = false) => {
    const current = allCosts.find(fc => fc.id === id);
    if (!current) return false;
    const today = todayET();

    if (!current.effective_from || current.effective_from >= today) {
      const { error } = await supabase.from('truck_fixed_costs' as any).update(changes as any).eq('id', id);
      if (error) return fail(error.message);
    } else {
      const { error: closeErr } = await supabase
        .from('truck_fixed_costs' as any)
        .update({ effective_to: today } as any)
        .eq('id', id);
      if (closeErr) return fail(closeErr.message);
      const { error: insertErr } = await supabase.from('truck_fixed_costs' as any).insert([{
        truck_id: current.truck_id,
        description: changes.description ?? current.description,
        amount: changes.amount ?? current.amount,
        frequency: changes.frequency ?? current.frequency,
        tenant_id: current.tenant_id,
        effective_from: today,
      } as any]);
      if (insertErr) return fail(insertErr.message);
    }

    await refresh();
    if (!silent) toastRef.current({ title: 'Fixed cost updated' });
    return true;
  }, [allCosts, refresh]);

  /** Quita un costo desde hoy. Si empezó hoy se borra; si es de antes, se cierra para conservar el historial. */
  const deleteFixedCost = useCallback(async (id: string) => {
    const current = allCosts.find(fc => fc.id === id);
    const today = todayET();
    const startedToday = !current?.effective_from || current.effective_from >= today;
    const { error } = startedToday
      ? await supabase.from('truck_fixed_costs' as any).delete().eq('id', id)
      : await supabase.from('truck_fixed_costs' as any).update({ effective_to: today } as any).eq('id', id);
    if (error) return fail(error.message);
    await refresh();
    return true;
  }, [allCosts, refresh]);

  /** Costos mensuales vigentes hoy (excluye por milla) */
  const getMonthlyFixedCosts = useCallback((truckId: string) => {
    return fixedCosts.filter(fc => fc.truck_id === truckId).reduce((sum, fc) => sum + toMonthly(fc), 0);
  }, [fixedCosts]);

  /** Costos por milla vigentes hoy */
  const getCostPerMile = useCallback((truckId: string) => {
    return fixedCosts
      .filter(fc => fc.truck_id === truckId && fc.frequency === 'per_mile')
      .reduce((sum, fc) => sum + Number(fc.amount || 0), 0);
  }, [fixedCosts]);

  /** Costos vigentes en una fecha (YYYY-MM-DD) */
  const getCostsAt = useCallback((truckId: string, date: string) => {
    const rows = allCosts.filter(fc => fc.truck_id === truckId && isActiveOn(fc, date));
    return {
      monthly: rows.reduce((sum, fc) => sum + toMonthly(fc), 0),
      perMile: rows.filter(fc => fc.frequency === 'per_mile').reduce((sum, fc) => sum + Number(fc.amount || 0), 0),
    };
  }, [allCosts]);

  /**
   * Costo fijo de UN día calendario (YYYY-MM-DD), con las versiones vigentes ese día.
   * Semanal ÷ 7, mensual ÷ días de ese mes, anual ÷ días de ese año. Excluye costos por milla.
   */
  const getDailyCostAt = useCallback((truckId: string, date: string) => {
    const [y, m] = date.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    return allCosts
      .filter(fc => fc.truck_id === truckId && fc.frequency !== 'per_mile' && isActiveOn(fc, date))
      .reduce((sum, fc) => {
        const amount = Number(fc.amount) || 0;
        switch (fc.frequency) {
          case 'weekly': return sum + amount / 7;
          case 'yearly': return sum + amount / daysInYear;
          default: return sum + amount / daysInMonth;
        }
      }, 0);
  }, [allCosts]);

  /** Get period-adjusted fixed costs */
  const getPeriodFixedCosts = useCallback((truckId: string, period: 'week' | 'month' | 'year') => {
    const monthly = getMonthlyFixedCosts(truckId);
    switch (period) {
      case 'week': return monthly / 4.33;
      case 'year': return monthly * 12;
      default: return monthly;
    }
  }, [getMonthlyFixedCosts]);

  return {
    fixedCosts, allCosts, loading,
    createFixedCost, updateFixedCost, deleteFixedCost,
    getMonthlyFixedCosts, getPeriodFixedCosts, getCostPerMile, getCostsAt, getDailyCostAt,
  };
}

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { calculateLoadProfit, type LoadProfit } from '@/lib/loadProfit';
import type { DbLoad } from '@/hooks/useLoads';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDispatcher } from '@/hooks/useDispatchers';

export const FROZEN_STATUSES = ['delivered', 'tonu', 'paid'];
/** Día en que empezó el cálculo de profit. Cargas anteriores no se calculan. */
const DEFAULT_START_DATE = '2026-09-14';

export const DIESEL_SNAPSHOTS_KEY = ['profit_data', 'diesel_snapshots'];

interface HistoryRow {
  entity_type: string;
  entity_id: string;
  field: string;
  value: number | null;
  value_text: string | null;
  effective_from: string;
}

/** Última fila vigente en la fecha (filas ordenadas por effective_from); si todas son posteriores, la primera */
function pickAt(rows: HistoryRow[] | undefined, date: string): HistoryRow | undefined {
  if (!rows || rows.length === 0) return undefined;
  let found = rows[0];
  for (const r of rows) {
    if (r.effective_from <= date) found = r;
    else break;
  }
  return found;
}

/** Fecha que rige el profit de la carga: su pickup (o su creación si no tiene) */
export function loadEffectiveDate(load: Pick<DbLoad, 'pickup_date' | 'created_at'>): string {
  return (load.pickup_date || load.created_at || '').split('T')[0];
}

/**
 * Profit por carga con los valores vigentes en la fecha de la carga.
 * Cada cambio de configuración vale desde el día en que se hizo; las cargas anteriores no cambian.
 */
export function useLoadProfitData() {
  const { getCostsAt } = useTruckFixedCosts();
  const { settings } = useTenantSettings();

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['profit_data', 'config_history'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profit_config_history' as any)
        .select('entity_type, entity_id, field, value, value_text, effective_from')
        .order('effective_from', { ascending: true });
      return ((data as any[]) || []) as HistoryRow[];
    },
  });

  const { data: expensesByLoad = {} } = useQuery({
    queryKey: ['profit_data', 'load_expenses'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase
        .from('expenses' as any)
        .select('load_id, total_amount') as any)
        .not('load_id', 'is', null);
      const map: Record<string, number> = {};
      ((data as any[]) || []).forEach(e => {
        map[e.load_id] = (map[e.load_id] || 0) + (Number(e.total_amount) || 0);
      });
      return map;
    },
  });

  const { data: dieselSnapshotByLoad = {} } = useQuery({
    queryKey: DIESEL_SNAPSHOTS_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase
        .from('loads' as any)
        .select('id, diesel_price_snapshot') as any)
        .in('status', FROZEN_STATUSES)
        .not('diesel_price_snapshot', 'is', null);
      const map: Record<string, number> = {};
      ((data as any[]) || []).forEach(l => { map[l.id] = Number(l.diesel_price_snapshot); });
      return map;
    },
  });

  const historyByKey = useMemo(() => {
    const map: Record<string, HistoryRow[]> = {};
    history.forEach(r => { (map[`${r.entity_type}:${r.entity_id}:${r.field}`] ??= []).push(r); });
    return map;
  }, [history]);

  const startDate = useMemo(
    () => history.reduce((min, r) => (r.effective_from < min ? r.effective_from : min), DEFAULT_START_DATE),
    [history],
  );

  // RLS solo devuelve el historial de este tenant
  const workingDaysHistory = useMemo(
    () => history.filter(r => r.entity_type === 'tenant' && r.field === 'working_days_per_month'),
    [history],
  );

  /** Valor vigente en la fecha. Si la entidad se creó después, usa su primer valor conocido. */
  const at = useCallback((type: string, id: string | undefined | null, field: string, date: string) => {
    if (!id) return undefined;
    return pickAt(historyByKey[`${type}:${id}:${field}`], date);
  }, [historyByKey]);

  const num = (row: HistoryRow | undefined, fallback: unknown) =>
    row ? Number(row.value) || 0 : Number(fallback) || 0;

  /** null si la carga es anterior al inicio del cálculo */
  const getLoadProfit = useCallback((
    load: DbLoad,
    driver: DbDriver | undefined,
    truck: DbTruck | undefined,
    dispatcher: DbDispatcher | undefined,
    overrides?: { loadedMiles?: number; emptyMiles?: number },
  ): LoadProfit | null => {
    const date = loadEffectiveDate(load);
    if (!date || date < startDate) return null;

    const d = driver as any;
    const disp = dispatcher as any;
    const serviceType = at('driver', driver?.id, 'service_type', date)?.value_text || d?.service_type || 'owner_operator';
    const isDispatchService = serviceType === 'dispatch_service';
    const snapshot = FROZEN_STATUSES.includes(load.status) ? dieselSnapshotByLoad[load.id] : undefined;
    const costs = truck ? getCostsAt(truck.id, date) : { monthly: 0, perMile: 0 };
    const workingDaysRow = pickAt(workingDaysHistory, date);
    const tenantWorkingDays = num(workingDaysRow, settings.working_days_per_month) || settings.working_days_per_month;

    return calculateLoadProfit({
      serviceType,
      totalRate: Number(load.total_rate) || 0,
      loadedMiles: overrides?.loadedMiles ?? (Number(load.miles) || 0),
      emptyMiles: overrides?.emptyMiles ?? (Number((load as any).empty_miles) || 0),
      pickupDate: load.pickup_date,
      deliveryDate: load.delivery_date,
      mpg: num(at('truck', truck?.id, 'mpg', date), (truck as any)?.mpg) || null,
      monthlyFixedCosts: costs.monthly,
      costPerMile: costs.perMile,
      driverPayPct: num(at('driver', driver?.id, 'pay_percentage', date), d?.pay_percentage),
      investorPayPct: num(at('driver', driver?.id, 'investor_pct', date), d?.investor_pay_percentage),
      dispatcherPct: isDispatchService
        ? (num(at('dispatcher', dispatcher?.id, 'dispatch_service_percentage', date), disp?.dispatch_service_percentage)
          || num(at('dispatcher', dispatcher?.id, 'commission_percentage', date), disp?.commission_percentage))
        : num(at('dispatcher', dispatcher?.id, 'commission_percentage', date), disp?.commission_percentage),
      factoringPct: num(at('driver', driver?.id, 'factoring_percentage', date), d?.factoring_percentage),
      dispatchServiceFeePct: num(at('driver', driver?.id, 'dispatch_service_percentage', date), d?.dispatch_service_percentage),
      actualExpenses: expensesByLoad[load.id] || 0,
      dieselPrice: snapshot ?? settings.diesel_price_per_gallon,
      dieselFrozen: snapshot != null,
      workingDaysPerMonth: tenantWorkingDays,
    });
  }, [at, startDate, workingDaysHistory, getCostsAt, settings, expensesByLoad, dieselSnapshotByLoad]);

  return { getLoadProfit, startDate, loading: historyLoading };
}

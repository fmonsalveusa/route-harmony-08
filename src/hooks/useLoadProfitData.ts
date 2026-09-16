import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { calculateLoadProfit, type LoadProfit } from '@/lib/loadProfit';
import type { DbLoad } from '@/hooks/useLoads';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDispatcher } from '@/hooks/useDispatchers';

const FROZEN_STATUSES = ['delivered', 'tonu', 'paid'];

/**
 * Datos en lote para calcular el profit de muchas cargas a la vez (gráficas),
 * con la misma lógica que la sección Rentabilidad del detalle de carga.
 */
export function useLoadProfitData() {
  const { getMonthlyFixedCosts, getCostPerMile } = useTruckFixedCosts();
  const { settings } = useTenantSettings();

  const { data: investorPctByDriver = {} } = useQuery({
    queryKey: ['profit_data', 'driver_investors'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('driver_investors' as any)
        .select('driver_id, pay_percentage')
        .eq('is_active', true);
      const map: Record<string, number> = {};
      ((data as any[]) || []).forEach(r => {
        map[r.driver_id] = (map[r.driver_id] || 0) + (Number(r.pay_percentage) || 0);
      });
      return map;
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
    queryKey: ['profit_data', 'diesel_snapshots'],
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

  const getLoadProfit = useCallback((
    load: DbLoad,
    driver: DbDriver | undefined,
    truck: DbTruck | undefined,
    dispatcher: DbDispatcher | undefined,
  ): LoadProfit => {
    const serviceType = (driver as any)?.service_type || 'owner_operator';
    const isDispatchService = serviceType === 'dispatch_service';
    const snapshot = FROZEN_STATUSES.includes(load.status) ? dieselSnapshotByLoad[load.id] : undefined;

    return calculateLoadProfit({
      serviceType,
      totalRate: Number(load.total_rate) || 0,
      loadedMiles: Number(load.miles) || 0,
      emptyMiles: Number((load as any).empty_miles) || 0,
      pickupDate: load.pickup_date,
      deliveryDate: load.delivery_date,
      mpg: Number((truck as any)?.mpg) || null,
      monthlyFixedCosts: truck ? getMonthlyFixedCosts(truck.id) : 0,
      costPerMile: truck ? getCostPerMile(truck.id) : 0,
      driverPayPct: Number((driver as any)?.pay_percentage) || 0,
      investorPayPct: driver
        ? (investorPctByDriver[driver.id] ?? (Number((driver as any).investor_pay_percentage) || 0))
        : 0,
      dispatcherPct: isDispatchService
        ? (Number((dispatcher as any)?.dispatch_service_percentage) || Number((dispatcher as any)?.commission_percentage) || 0)
        : (Number((dispatcher as any)?.commission_percentage) || 0),
      factoringPct: Number((driver as any)?.factoring_percentage) || 0,
      dispatchServiceFeePct: Number((driver as any)?.dispatch_service_percentage) || 0,
      actualExpenses: expensesByLoad[load.id] || 0,
      dieselPrice: snapshot ?? settings.diesel_price_per_gallon,
      dieselFrozen: snapshot != null,
      workingDaysPerMonth: settings.working_days_per_month,
    });
  }, [getMonthlyFixedCosts, getCostPerMile, settings, investorPctByDriver, expensesByLoad, dieselSnapshotByLoad]);

  return { getLoadProfit };
}

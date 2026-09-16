import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { useTruckVariableCosts } from '@/hooks/useTruckVariableCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { calculateLoadProfit } from '@/lib/loadProfit';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbDispatcher } from '@/hooks/useDispatchers';

interface Props {
  loadId: string;
  totalRate: number;
  loadedMiles: number;
  emptyMiles: number;
  pickupDate: string | null;
  deliveryDate: string | null;
  truck: DbTruck | undefined;
  driver: DbDriver | undefined;
  dispatcher: DbDispatcher | undefined;
}

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LoadProfitSection({
  loadId, totalRate, loadedMiles, emptyMiles, pickupDate, deliveryDate, truck, driver, dispatcher,
}: Props) {
  const { getMonthlyFixedCosts } = useTruckFixedCosts();
  const { getCostPerMile } = useTruckVariableCosts();
  const { settings } = useTenantSettings();
  const [actualExpenses, setActualExpenses] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase
        .from('expenses' as any)
        .select('total_amount') as any)
        .eq('load_id', loadId);
      if (cancelled) return;
      setActualExpenses(((data as any[]) || []).reduce((s, e) => s + (Number(e.total_amount) || 0), 0));
    })();
    return () => { cancelled = true; };
  }, [loadId]);

  if (!truck) {
    return (
      <div className="p-3 rounded-lg bg-card border text-sm">
        <h5 className="font-semibold mb-1 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Rentabilidad
        </h5>
        <p className="text-xs text-muted-foreground">Asigna un camión para calcular el profit de esta carga.</p>
      </div>
    );
  }

  const profit = calculateLoadProfit({
    totalRate,
    loadedMiles,
    emptyMiles,
    pickupDate,
    deliveryDate,
    mpg: Number(truck.mpg) || null,
    monthlyFixedCosts: getMonthlyFixedCosts(truck.id),
    costPerMile: getCostPerMile(truck.id),
    driverPayPct: Number((driver as any)?.pay_percentage) || 0,
    dispatcherPct: Number((dispatcher as any)?.commission_percentage) || 0,
    factoringPct: Number((driver as any)?.factoring_percentage) || 0,
    actualExpenses,
    dieselPrice: settings.diesel_price_per_gallon,
    workingDaysPerMonth: settings.working_days_per_month,
  });

  const isProfit = profit.netProfit >= 0;
  const missingConfig = !truck.mpg || profit.lines.length === 0;

  return (
    <div className="p-3 rounded-lg bg-card border text-sm">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold flex items-center gap-1.5">
          {isProfit
            ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(152,60%,40%)]" />
            : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          Rentabilidad
        </h5>
        <span className="text-[11px] text-muted-foreground">
          {profit.totalMiles.toLocaleString()} mi · {profit.days} día{profit.days > 1 ? 's' : ''}
        </span>
      </div>

      {missingConfig && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          <Settings2 className="h-3 w-3 flex-shrink-0" />
          Configura MPG y costos del camión #{truck.unit_number} en Performance → Cost Configuration
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between py-1 border-b">
          <span className="font-medium">Rate</span>
          <span className="font-semibold text-primary">{fmt(profit.rate)}</span>
        </div>

        {profit.lines.map(line => (
          <div key={line.label} className="flex items-center justify-between py-0.5">
            <div className="min-w-0">
              <span className="text-xs">{line.label}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{line.detail}</span>
            </div>
            <span className="text-xs text-destructive whitespace-nowrap">−{fmt(line.amount)}</span>
          </div>
        ))}

        <div className="flex items-center justify-between py-1 border-t">
          <span className="text-xs font-medium text-muted-foreground">Costos totales</span>
          <span className="text-xs font-semibold text-destructive">−{fmt(profit.totalCosts)}</span>
        </div>

        <div className={`flex items-center justify-between px-2 py-2 rounded-md mt-1 ${
          isProfit ? 'bg-[hsl(152,60%,40%)]/10' : 'bg-destructive/10'
        }`}>
          <span className="font-bold">Profit neto</span>
          <div className="text-right">
            <div className={`text-base font-bold ${isProfit ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
              {isProfit ? '' : '−'}{fmt(profit.netProfit)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {profit.margin.toFixed(1)}% margen · ${profit.profitPerMile.toFixed(2)}/mi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

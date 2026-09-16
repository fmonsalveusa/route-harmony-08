import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { calculateLoadProfit } from '@/lib/loadProfit';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbDispatcher } from '@/hooks/useDispatchers';

interface Props {
  loadId: string;
  status: string;
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
  loadId, status, totalRate, loadedMiles, emptyMiles, pickupDate, deliveryDate, truck, driver, dispatcher,
}: Props) {
  const { getMonthlyFixedCosts, getCostPerMile } = useTruckFixedCosts();
  const { settings } = useTenantSettings();
  const [actualExpenses, setActualExpenses] = useState(0);
  const [investorPct, setInvestorPct] = useState(0);
  const [dieselSnapshot, setDieselSnapshot] = useState<number | null>(null);

  // Entregada → precio congelado al entregar. Activa → precio actual.
  const isFrozen = ['delivered', 'tonu', 'paid'].includes(status);

  useEffect(() => {
    let cancelled = false;
    if (!isFrozen) { setDieselSnapshot(null); return; }
    (async () => {
      const { data } = await (supabase
        .from('loads' as any)
        .select('diesel_price_snapshot') as any)
        .eq('id', loadId)
        .maybeSingle();
      if (cancelled) return;
      const n = Number(data?.diesel_price_snapshot);
      setDieselSnapshot(Number.isFinite(n) && n > 0 ? n : null);
    })();
    return () => { cancelled = true; };
  }, [loadId, isFrozen]);

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

  // Investor % — driver_investors (soporta múltiples) con fallback al campo legacy
  useEffect(() => {
    let cancelled = false;
    if (!driver) { setInvestorPct(0); return; }
    (async () => {
      const { data } = await supabase
        .from('driver_investors' as any)
        .select('pay_percentage')
        .eq('driver_id', driver.id)
        .eq('is_active', true);
      if (cancelled) return;
      const rows = (data as any[]) || [];
      if (rows.length > 0) {
        setInvestorPct(rows.reduce((s, r) => s + (Number(r.pay_percentage) || 0), 0));
      } else {
        setInvestorPct(Number((driver as any).investor_pay_percentage) || 0);
      }
    })();
    return () => { cancelled = true; };
  }, [driver]);

  const serviceType = (driver as any)?.service_type || 'owner_operator';
  const isCompanyDriver = serviceType === 'company_driver';
  const isDispatchService = serviceType === 'dispatch_service';

  if (isCompanyDriver && !truck) {
    return (
      <div className="p-3 rounded-lg bg-card border text-sm">
        <h5 className="font-semibold mb-1 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Rentabilidad
        </h5>
        <p className="text-xs text-muted-foreground">Asigna un camión para calcular el profit de esta carga.</p>
      </div>
    );
  }

  const dispatcherPct = isDispatchService
    ? (Number((dispatcher as any)?.dispatch_service_percentage) || Number((dispatcher as any)?.commission_percentage) || 0)
    : (Number((dispatcher as any)?.commission_percentage) || 0);

  const profit = calculateLoadProfit({
    serviceType,
    totalRate,
    loadedMiles,
    emptyMiles,
    pickupDate,
    deliveryDate,
    mpg: Number(truck?.mpg) || null,
    monthlyFixedCosts: truck ? getMonthlyFixedCosts(truck.id) : 0,
    costPerMile: truck ? getCostPerMile(truck.id) : 0,
    driverPayPct: Number((driver as any)?.pay_percentage) || 0,
    investorPayPct: investorPct,
    dispatcherPct,
    factoringPct: Number((driver as any)?.factoring_percentage) || 0,
    dispatchServiceFeePct: Number((driver as any)?.dispatch_service_percentage) || 0,
    actualExpenses,
    dieselPrice: dieselSnapshot ?? settings.diesel_price_per_gallon,
    dieselFrozen: dieselSnapshot != null,
    workingDaysPerMonth: settings.working_days_per_month,
  });

  const isProfit = profit.netProfit >= 0;
  const missingConfig = isCompanyDriver && (!truck?.mpg || getCostPerMile(truck.id) === 0);

  return (
    <div className="p-3 rounded-lg bg-card border text-sm">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold flex items-center gap-1.5">
          {isProfit
            ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(152,60%,40%)]" />
            : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          Rentabilidad
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
            {profit.serviceLabel}
          </span>
        </h5>
        <span className="text-[11px] text-muted-foreground">
          {isCompanyDriver && `${profit.totalMiles.toLocaleString()} mi · ${profit.days} día${profit.days > 1 ? 's' : ''}`}
        </span>
      </div>

      {missingConfig && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          <Settings2 className="h-3 w-3 flex-shrink-0" />
          Configura MPG y costos del camión #{truck?.unit_number} en Fleet → detalle del camión
        </div>
      )}

      <div className="space-y-1">
        {/* Rate de la carga — para dispatch service no es ingreso nuestro */}
        {isDispatchService && (
          <div className="flex items-center justify-between py-0.5 text-muted-foreground">
            <span className="text-xs">Rate de la carga</span>
            <span className="text-xs">{fmt(profit.rate)}</span>
          </div>
        )}

        <div className="flex items-center justify-between py-1 border-b">
          <div className="min-w-0">
            <span className="font-medium">{isDispatchService ? 'Dispatch Fee' : 'Rate'}</span>
            {profit.revenueDetail && (
              <span className="text-[10px] text-muted-foreground ml-1.5">{profit.revenueDetail}</span>
            )}
          </div>
          <span className="font-semibold text-primary">{fmt(profit.revenue)}</span>
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
              {profit.margin.toFixed(1)}% margen
              {isCompanyDriver && ` · $${profit.profitPerMile.toFixed(2)}/mi`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useLoadProfitData, DIESEL_SNAPSHOTS_KEY } from '@/hooks/useLoadProfitData';
import type { DbLoad } from '@/hooks/useLoads';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbDispatcher } from '@/hooks/useDispatchers';

interface Props {
  load: DbLoad;
  /** Millas vivas del detalle (pueden recalcularse antes de refrescar la carga) */
  loadedMiles: number;
  emptyMiles: number;
  truck: DbTruck | undefined;
  driver: DbDriver | undefined;
  dispatcher: DbDispatcher | undefined;
}

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const usDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
};

function Header({ children }: { children?: React.ReactNode }) {
  return <h5 className="font-semibold flex items-center gap-1.5">{children}</h5>;
}

export function LoadProfitSection({ load, loadedMiles, emptyMiles, truck, driver, dispatcher }: Props) {
  const { getLoadProfit, startDate, loading } = useLoadProfitData();
  const queryClient = useQueryClient();

  // Al entregar, el trigger congela el diésel — refrescar para leer el valor guardado
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: DIESEL_SNAPSHOTS_KEY });
  }, [load.status, queryClient]);

  // Si cambian las fechas o el camión, se recalcula el reparto de días compartidos
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['profit_data', 'truck_load_spans'] });
  }, [load.pickup_date, load.delivery_date, load.truck_id, load.status, queryClient]);

  if (loading) return null;

  const profit = getLoadProfit(load, driver, truck, dispatcher, { loadedMiles, emptyMiles });

  if (!profit) {
    return (
      <div className="p-3 rounded-lg bg-card border text-sm">
        <Header><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /> Rentabilidad</Header>
        <p className="text-xs text-muted-foreground mt-1">
          No disponible: la carga es anterior al {usDate(startDate)}, fecha en que empezó el cálculo de profit.
        </p>
      </div>
    );
  }

  const isCompanyDriver = profit.serviceType === 'company_driver';
  const isDispatchService = profit.serviceType === 'dispatch_service';
  const isProfit = profit.netProfit >= 0;

  if (isCompanyDriver && !truck) {
    return (
      <div className="p-3 rounded-lg bg-card border text-sm">
        <Header><TrendingUp className="h-3.5 w-3.5 text-primary" /> Rentabilidad</Header>
        <p className="text-xs text-muted-foreground mt-1">Asigna un camión para calcular el profit de esta carga.</p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-card border text-sm">
      <div className="flex items-center justify-between mb-2">
        <Header>
          {isProfit
            ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(152,60%,40%)]" />
            : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          Rentabilidad
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
            {profit.serviceLabel}
          </span>
        </Header>
        <span className="text-[11px] text-muted-foreground">
          {isCompanyDriver && `${profit.totalMiles.toLocaleString()} mi · ${profit.days} día${profit.days > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="space-y-1">
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

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import type { DbLoad } from '@/hooks/useLoads';
import type { DbDriver } from '@/hooks/useDrivers';
import type { DbTruck } from '@/hooks/useTrucks';
import type { DbDispatcher } from '@/hooks/useDispatchers';
import { useLoadProfitData } from '@/hooks/useLoadProfitData';

const POSITIVE = '#16a34a';
const NEGATIVE = '#dc2626';

interface Props {
  loads: DbLoad[];
  drivers: DbDriver[];
  trucks: DbTruck[];
  dispatchers: DbDispatcher[];
  serviceType?: string;
}

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

export function ProfitByDriverChart({ loads, drivers, trucks, dispatchers, serviceType }: Props) {
  const { getLoadProfit } = useLoadProfitData();

  const data = useMemo(() => {
    const byDriver: Record<string, { profit: number; revenue: number; loads: number }> = {};

    loads.forEach(l => {
      if (l.status === 'cancelled' || !l.driver_id) return;
      const driver = drivers.find(d => d.id === l.driver_id);
      if (serviceType && serviceType !== 'all' && driver?.service_type !== serviceType) return;

      const truck = trucks.find(t => String(t.id) === String(l.truck_id));
      const dispatcher = dispatchers.find(d => d.id === l.dispatcher_id);
      const p = getLoadProfit(l, driver, truck, dispatcher);

      const row = (byDriver[l.driver_id] ??= { profit: 0, revenue: 0, loads: 0 });
      row.profit += p.netProfit;
      row.revenue += p.revenue;
      row.loads += 1;
    });

    return Object.entries(byDriver)
      .map(([driverId, r]) => ({
        name: drivers.find(d => d.id === driverId)?.name || 'Unknown',
        profit: Math.round(r.profit * 100) / 100,
        margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
        loads: r.loads,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [loads, drivers, trucks, dispatchers, serviceType, getLoadProfit]);

  const total = data.reduce((s, d) => s + d.profit, 0);
  const hasNegative = data.some(d => d.profit < 0);

  const renderLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const negative = value < 0;
    return (
      <text
        x={x + width / 2}
        y={negative ? y + height + 14 : y - 8}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
      >
        {money(Number(value))}
      </text>
    );
  };

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold leading-none tracking-tight">Drivers Net Profit</h3>
        {data.length > 0 && (
          <span className={`text-sm font-bold ${total >= 0 ? 'text-[#16a34a]' : 'text-destructive'}`}>
            Total {money(total)}
          </span>
        )}
      </div>
      <div className="px-6 pb-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin datos para los filtros seleccionados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toFixed(0)}k`}
                domain={[
                  hasNegative ? (min: number) => Math.floor(min * 1.25) : 0,
                  (max: number) => Math.ceil(Math.max(max, 0) * 1.15),
                ]}
              />
              {hasNegative && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />}
              <Tooltip
                formatter={(v: number, _n, item: any) => [
                  `${money(v)} · ${item.payload.margin.toFixed(1)}% margen · ${item.payload.loads} carga${item.payload.loads !== 1 ? 's' : ''}`,
                  'Profit neto',
                ]}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? POSITIVE : NEGATIVE} />)}
                <LabelList dataKey="profit" content={renderLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

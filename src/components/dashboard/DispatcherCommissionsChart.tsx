import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { DbDispatcher } from '@/hooks/useDispatchers';
import { DbDriver } from '@/hooks/useDrivers';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  loads: DbLoad[];
  dispatchers: DbDispatcher[];
  drivers: DbDriver[];
  year: string;
  month: string;
  week: string;
}

const BAR_COLORS = [
  '#9333ea', '#e85d04', '#2563eb', '#16a34a', '#dc2626',
  '#0891b2', '#ca8a04', '#6366f1', '#059669', '#d946ef',
];

const renderTopLabel = (props: any) => {
  const { x, y, width, value } = props;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="#1e3a5f"
      textAnchor="middle"
      dominantBaseline="auto"
      fontSize={12}
      fontWeight={700}
    >
      ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </text>
  );
};

export function DispatcherCommissionsChart({ loads, dispatchers, drivers, year, month, week }: Props) {
  const data = useMemo(() => {
    const dispatcherMap: Record<string, { name: string; commPct: number; dispSvcPct: number }> = {};
    dispatchers.forEach(d => {
      dispatcherMap[d.id] = { name: d.name, commPct: d.commission_percentage, dispSvcPct: d.dispatch_service_percentage };
    });

    const driverMap: Record<string, string> = {};
    drivers.forEach(d => { driverMap[d.id] = d.service_type; });

    const filtered = loads.filter(l => l.status !== 'cancelled' && l.dispatcher_id);

    const byDispatcher: Record<string, number> = {};
    filtered.forEach(l => {
      const disp = dispatcherMap[l.dispatcher_id!];
      if (!disp) return;
      const serviceType = l.driver_id ? (driverMap[l.driver_id] || 'owner_operator') : 'owner_operator';
      const pct = serviceType === 'dispatch_service' ? disp.dispSvcPct : disp.commPct;
      const commission = l.total_rate * (pct / 100);
      byDispatcher[l.dispatcher_id!] = (byDispatcher[l.dispatcher_id!] || 0) + commission;
    });

    return Object.entries(byDispatcher)
      .map(([id, total]) => ({
        name: dispatcherMap[id]?.name || 'Unknown',
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [loads, dispatchers, drivers, year, month, week]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Comisiones por Dispatcher</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin datos para los filtros seleccionados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Comisión']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                <LabelList dataKey="total" content={renderTopLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

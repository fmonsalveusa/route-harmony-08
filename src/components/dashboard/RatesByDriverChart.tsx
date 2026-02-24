import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { DbDriver } from '@/hooks/useDrivers';
import { getISOWeek } from '@/lib/dateUtils';

const BAR_COLORS = [
  '#2563eb', '#e85d04', '#16a34a', '#9333ea', '#dc2626',
  '#0891b2', '#ca8a04', '#6366f1', '#059669', '#d946ef',
];

interface Props {
  loads: DbLoad[];
  drivers: DbDriver[];
  year: string;
  month: string;
  week: string;
}

export function RatesByDriverChart({ loads, drivers, year, month, week }: Props) {
  const data = useMemo(() => {
    const filtered = loads.filter(l => l.status !== 'cancelled' && l.driver_id);

    const byDriver: Record<string, number> = {};
    filtered.forEach(l => {
      if (l.driver_id) byDriver[l.driver_id] = (byDriver[l.driver_id] || 0) + l.total_rate;
    });

    return Object.entries(byDriver)
      .map(([driverId, total]) => {
        const driver = drivers.find(d => d.id === driverId);
        return { name: driver?.name || 'Unknown', total };
      })
      .sort((a, b) => b.total - a.total);
  }, [loads, drivers, year, month, week]);

  const renderTopLabel = (props: any) => {
    const { x, y, width, value } = props;
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={12}
        fontWeight={700}
      >
        ${Number(value).toLocaleString()}
      </text>
    );
  };

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-base font-semibold leading-none tracking-tight">Drivers Performance</h3>
      </div>
      <div className="px-6 pb-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin datos para los filtros seleccionados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total Rate']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                <LabelList dataKey="total" content={renderTopLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

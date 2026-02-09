import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  loads: DbLoad[];
}

const renderVerticalLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (height < 40) return null;
  return (
    <text
      x={x + width / 2}
      y={y + 30}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={14}
      fontWeight={700}
      transform={`rotate(-90, ${x + width / 2}, ${y + 30})`}
    >
      ${Number(value).toLocaleString()}
    </text>
  );
};

export function WeeklyRatesChart({ loads }: Props) {
  const data = useMemo(() => {
    const byWeek: Record<string, number> = {};
    loads.forEach(l => {
      if (l.status === 'cancelled') return;
      const d = l.pickup_date || l.created_at;
      if (!d) return;
      const date = new Date(d);
      const yr = date.getFullYear();
      const wk = getISOWeek(date);
      const key = `${yr}-W${String(wk).padStart(2, '0')}`;
      byWeek[key] = (byWeek[key] || 0) + l.total_rate;
    });

    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, total]) => ({ week, total }));
  }, [loads]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Rates Acumulados por Semana</CardTitle>
          <span className="text-xs text-muted-foreground">Sin filtros · Todas las semanas</span>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={[0, (max: number) => Math.ceil(max * 1.1)]} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total Rate']} />
              <Bar dataKey="total" fill="hsl(var(--chart-2, 152 60% 40%))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" content={renderVerticalLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

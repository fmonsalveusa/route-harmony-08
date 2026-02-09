import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  loads: DbLoad[];
}

export function WeeklyRatesChart({ loads }: Props) {
  const data = useMemo(() => {
    const byWeek: Record<string, number> = {};
    loads.forEach(l => {
      if (l.status === 'cancelled') return;
      const d = l.pickup_date || l.created_at;
      if (!d) return;
      const raw = d.split('T')[0];
      const [y, m, day] = raw.split('-').map(Number);
      const date = new Date(y, m - 1, day);
      const yr = date.getFullYear();
      const wk = getISOWeek(date);
      const key = `${yr}-W${String(wk).padStart(2, '0')}`;
      byWeek[key] = (byWeek[key] || 0) + l.total_rate;
    });

    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, total]) => ({
        week: week.replace(/^\d{4}-/, ''),
        total,
      }));
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
            <AreaChart data={data}>
              <defs>
                <linearGradient id="weeklyRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                interval={data.length > 20 ? Math.floor(data.length / 10) : 0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                domain={[0, (max: number) => Math.ceil(max * 1.1)]}
              />
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total Rate']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#weeklyRateGradient)"
                dot={{ r: data.length <= 20 ? 3 : 0, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

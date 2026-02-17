import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  loads: DbLoad[];
}

export function WeeklyRatesChart({ loads }: Props) {
  const { data, trend } = useMemo(() => {
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

    const sorted = Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, total], i, arr) => {
        let pctChange: number | null = null;
        if (i > 0) {
          const prev = arr[i - 1][1];
          if (prev > 0) pctChange = ((total - prev) / prev) * 100;
        }
        return { week: week.replace(/^\d{4}-/, ''), total, pctChange };
      });

    let trend: { value: string; positive: boolean } | null = null;
    if (sorted.length >= 2) {
      const last = sorted[sorted.length - 1];
      if (last.pctChange !== null) {
        trend = { value: `${Math.abs(last.pctChange).toFixed(1)}%`, positive: last.pctChange >= 0 };
      }
    }

    return { data: sorted, trend };
  }, [loads]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Production</CardTitle>
          <span className="text-xs text-muted-foreground">No filters · All weeks</span>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No data</p>
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
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                interval={data.length > 20 ? Math.floor(data.length / 10) : 0}
                angle={-45}
                textAnchor="end"
                height={50}
                padding={{ left: 30, right: 40 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                domain={[0, (max: number) => Math.ceil(max * 1.1 / 1000) * 1000]}
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
                dot={{ r: data.length <= 20 ? 4 : 0, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                label={data.length <= 20 ? ({ x, y, value, index }: any) => {
                  const item = data[index];
                  const pct = item?.pctChange;
                  const valText = `$${Number(value).toLocaleString()}`;
                  const pctText = pct !== null && pct !== undefined ? ` ${pct >= 0 ? '↑' : '↓'}${Math.abs(pct).toFixed(1)}%` : '';
                  return (
                    <text x={x} y={y - 12} textAnchor="middle" fontSize={11} fontWeight={700}>
                      <tspan fill="hsl(var(--foreground))">{valText}</tspan>
                      {pctText && (
                        <tspan fill={pct! >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} fontSize={9}>{pctText}</tspan>
                      )}
                    </text>
                  );
                } : undefined}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { getISOWeek } from '@/lib/dateUtils';

// Query propia — solo trae los 2 campos necesarios de TODAS las cargas
async function fetchWeeklyData() {
  const { data, error } = await supabase
    .from('loads')
    .select('pickup_date, created_at, total_rate, status')
    .neq('status', 'cancelled')
    .order('pickup_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function WeeklyRatesChart() {
  // Query independiente — no depende del límite de useLoads
  const { data: rawLoads = [] } = useQuery({
    queryKey: ['weekly-rates-chart'],
    queryFn: fetchWeeklyData,
    staleTime: 24 * 60 * 60 * 1000, // solo refresca al agregar carga nueva 
  });

  const { data, trend } = useMemo(() => {
    const byWeek: Record<string, number> = {};

    rawLoads.forEach(l => {
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

    // Solo mostrar las últimas 10 semanas
const last10 = sorted.slice(-10);
return { data: last10, trend };
  }, [rawLoads]);

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold leading-none tracking-tight">Weekly Production</h3>
          <span className="text-xs text-muted-foreground">No filters · All weeks</span>
        </div>
      </div>
      <div className="px-6 pb-6">
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
      </div>
    </div>
  );
}

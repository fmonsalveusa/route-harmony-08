import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DbPayment } from '@/hooks/usePayments';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  payments: DbPayment[];
  year: string;
  month: string;
  week: string;
}

export function DispatcherCommissionsChart({ payments, year, month, week }: Props) {
  const data = useMemo(() => {
    const filtered = payments.filter(p => {
      if (p.recipient_type !== 'dispatcher') return false;
      const d = p.created_at;
      if (!d) return false;
      const date = new Date(d);
      if (year !== 'all' && date.getFullYear() !== Number(year)) return false;
      if (month !== 'all' && (date.getMonth() + 1) !== Number(month)) return false;
      if (week !== 'all' && getISOWeek(date) !== Number(week)) return false;
      return true;
    });

    const byDispatcher: Record<string, number> = {};
    filtered.forEach(p => {
      byDispatcher[p.recipient_name] = (byDispatcher[p.recipient_name] || 0) + p.amount;
    });

    return Object.entries(byDispatcher)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [payments, year, month, week]);

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
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Comisión']} />
              <Bar dataKey="total" fill="hsl(var(--chart-4, 38 92% 50%))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

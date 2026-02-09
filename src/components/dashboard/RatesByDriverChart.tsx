import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { DbDriver } from '@/hooks/useDrivers';
import { getISOWeek } from '@/lib/dateUtils';

interface Props {
  loads: DbLoad[];
  drivers: DbDriver[];
  year: string;
  month: string;
  week: string;
}

export function RatesByDriverChart({ loads, drivers, year, month, week }: Props) {
  const data = useMemo(() => {
    const filtered = loads.filter(l => {
      if (l.status === 'cancelled' || !l.driver_id) return false;
      const d = l.pickup_date || l.created_at;
      if (!d) return false;
      const date = new Date(d);
      if (year !== 'all' && date.getFullYear() !== Number(year)) return false;
      if (month !== 'all' && (date.getMonth() + 1) !== Number(month)) return false;
      if (week !== 'all' && getISOWeek(date) !== Number(week)) return false;
      return true;
    });

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Total Rates por Driver</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin datos para los filtros seleccionados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total Rate']} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

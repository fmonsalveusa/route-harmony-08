import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
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

  const renderVerticalLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (height < 40) return null;
    return (
      <text
        x={x + width / 2}
        y={y + 16}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={700}
        transform={`rotate(-90, ${x + width / 2}, ${y + 16})`}
      >
        ${Number(value).toLocaleString()}
      </text>
    );
  };

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
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total Rate']} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" content={renderVerticalLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

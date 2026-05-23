import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { DbLoad } from '@/hooks/useLoads';
import { DbDispatcher } from '@/hooks/useDispatchers';

interface Props {
  loads: DbLoad[];
  dispatchers: DbDispatcher[];
  year: string;
  month: string;
  week: string;
}

const COLORS = {
  company:    '#266aad',
  oo:         '#f59e0b',
  dispatch:   '#9333ea',
  total:      '#16a34a',
};

const fmt = (v: number) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const TopLabel = ({ x, y, width, value }: any) => {
  if (!value || value === 0) return null;
  return (
    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight="700" fill="hsl(var(--foreground))">
      {fmt(value)}
    </text>
  );
};

export function DispatcherCommissionsChart({ loads, dispatchers, year, month, week }: Props) {
  const data = useMemo(() => {
    const dispMap: Record<string, { name: string; commPct: number; dispSvcPct: number }> = {};
    dispatchers.forEach(d => {
      dispMap[d.id] = { name: d.name, commPct: d.commission_percentage, dispSvcPct: d.dispatch_service_percentage };
    });

    const filtered = loads.filter(l => l.status !== 'cancelled' && l.dispatcher_id);

    const byDisp: Record<string, { company: number; oo: number; dispatch: number }> = {};

    filtered.forEach(l => {
      const disp = dispMap[l.dispatcher_id!];
      if (!disp) return;
      if (!byDisp[l.dispatcher_id!]) byDisp[l.dispatcher_id!] = { company: 0, oo: 0, dispatch: 0 };

      const st = l.service_type;
      if (st === 'dispatch_service') {
        byDisp[l.dispatcher_id!].dispatch += l.total_rate * (disp.dispSvcPct / 100);
      } else if (st === 'owner_operator') {
        byDisp[l.dispatcher_id!].oo += l.total_rate * (disp.commPct / 100);
      } else {
        // company_driver
        byDisp[l.dispatcher_id!].company += l.total_rate * (disp.commPct / 100);
      }
    });

    return Object.entries(byDisp)
      .map(([id, vals]) => ({
        name: dispMap[id]?.name || 'Unknown',
        'Company Drivers': Math.round(vals.company * 100) / 100,
        'Owner Operators': Math.round(vals.oo * 100) / 100,
        'Dispatch Service': Math.round(vals.dispatch * 100) / 100,
        'Total': Math.round((vals.company + vals.oo + vals.dispatch) * 100) / 100,
      }))
      .sort((a, b) => b.Total - a.Total);
  }, [loads, dispatchers, year, month, week]);

  const totalGeneral = data.reduce((s, d) => s + d['Total'], 0);

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-base font-semibold leading-none tracking-tight">Weekly Dispatcher Commissions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Total: <span className="font-semibold text-foreground">${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </p>
      </div>
      <div className="px-6 pb-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No data for selected filters</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 60 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="square"
              />
              <Bar dataKey="Total" fill={COLORS.total} radius={[3, 3, 0, 0]} maxBarSize={30}>
                <LabelList content={TopLabel} />
              </Bar>
              <Bar dataKey="Owner Operators" fill={COLORS.oo} radius={[3, 3, 0, 0]} maxBarSize={30}>
                <LabelList content={TopLabel} />
              </Bar>
              <Bar dataKey="Company Drivers" fill={COLORS.company} radius={[3, 3, 0, 0]} maxBarSize={30}>
                <LabelList content={TopLabel} />
              </Bar>
              <Bar dataKey="Dispatch Service" fill={COLORS.dispatch} radius={[3, 3, 0, 0]} maxBarSize={30}>
                <LabelList content={TopLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

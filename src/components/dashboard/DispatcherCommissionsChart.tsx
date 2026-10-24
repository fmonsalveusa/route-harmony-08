import { useMemo, useState } from 'react';
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

// Fecha de creación de la carga en hora del Este (YYYY-MM-DD)
const createdDateET = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/**
 * Igual que el pago de comisión: la carga cuenta en la semana/mes/año en que se CREÓ
 * (no por pickup), con la comisión guardada en la carga (dispatcher_pay_amount).
 */
function inPeriod(dateStr: string, year: string, month: string, week: string) {
  const d = new Date(dateStr + 'T00:00:00');
  if (year !== 'all' && d.getFullYear() !== Number(year)) return false;
  if (month !== 'all' && (d.getMonth() + 1) !== Number(month)) return false;
  if (week !== 'all') {
    const yr = year !== 'all' ? Number(year) : new Date().getFullYear();
    const jan4 = new Date(yr, 0, 4);
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const weekStart = new Date(mondayOfWeek1);
    weekStart.setDate(mondayOfWeek1.getDate() + (Number(week) - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    if (d < weekStart || d >= weekEnd) return false;
  }
  return true;
}

export function DispatcherCommissionsChart({ loads, dispatchers, year, month, week }: Props) {
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>('all');

  const data = useMemo(() => {
    const dispMap: Record<string, { name: string; commPct: number; dispSvcPct: number }> = {};
    dispatchers.forEach(d => {
      dispMap[d.id] = { name: d.name, commPct: d.commission_percentage, dispSvcPct: d.dispatch_service_percentage };
    });

    const filtered = loads.filter(l =>
      l.status !== 'cancelled' && l.dispatcher_id && l.created_at && inPeriod(createdDateET(l.created_at), year, month, week),
    );

    const byDisp: Record<string, { company: number; oo: number; dispatch: number }> = {};

    filtered.forEach(l => {
      const disp = dispMap[l.dispatcher_id!];
      if (!disp) return;
      if (!byDisp[l.dispatcher_id!]) byDisp[l.dispatcher_id!] = { company: 0, oo: 0, dispatch: 0 };

      const st = l.service_type;
      // La comisión que se paga es la guardada en la carga (respeta C1/C2/DS); si no tiene, se estima
      const stored = Number(l.dispatcher_pay_amount) || 0;
      const pct = st === 'dispatch_service' ? disp.dispSvcPct : disp.commPct;
      const amount = stored > 0 ? stored : l.total_rate * (pct / 100);
      if (st === 'dispatch_service') {
        byDisp[l.dispatcher_id!].dispatch += amount;
      } else if (st === 'owner_operator') {
        byDisp[l.dispatcher_id!].oo += amount;
      } else {
        // company_driver
        byDisp[l.dispatcher_id!].company += amount;
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

  const filteredData = selectedDispatcher === 'all'
    ? data
    : data.filter(d => d.name === dispatchers.find(dp => dp.id === selectedDispatcher)?.name);

  const totalGeneral = filteredData.reduce((s, d) => s + d['Total'], 0);

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold leading-none tracking-tight">Weekly Dispatcher Commissions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total: <span className="font-semibold text-foreground">${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </p>
          </div>
          <select
            value={selectedDispatcher}
            onChange={e => setSelectedDispatcher(e.target.value)}
            className="h-8 text-xs border rounded-md px-2 bg-background text-foreground"
          >
            <option value="all">Todos</option>
            {dispatchers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="px-6 pb-6">
        {filteredData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No data for selected filters</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredData} margin={{ top: 20, right: 8, left: 8, bottom: 60 }} barGap={3}>
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

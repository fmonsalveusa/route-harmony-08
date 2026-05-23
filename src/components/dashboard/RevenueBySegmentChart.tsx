import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface Load {
  id: string;
  total_rate: number;
  pickup_date: string | null;
  status: string;
  driver_id: string | null;
}
interface Driver {
  id: string;
  service_type: string;
  pay_percentage: number;
  investor_pay_percentage: number | null;
  dispatcher_id: string | null;
}
interface Dispatcher {
  id: string;
  commission_percentage: number;
  dispatch_service_percentage: number;
}
interface Expense {
  id: string;
  truck_id: string | null;
  expense_date: string;
  total_amount: number;
}
interface Props {
  loads: Load[];
  drivers: Driver[];
  dispatchers: Dispatcher[];
  expenses: Expense[];
}

type Period = 'this_week' | 'this_month' | 'this_year' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'Esta semana',
  this_month: 'Este mes',
  this_year: 'Este año',
  custom: 'Personalizado',
};

// Colors per concept
const COLORS = {
  bruto:      '#266aad',
  drivers:    '#f59e0b',
  gastos:     '#ef4444',
  investor:   '#8b5cf6',
  dispatcher: '#f97316',
  neto:       '#16a34a',
};

function getWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function isInPeriod(dateStr: string, period: Period, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  if (period === 'this_week') { const { start, end } = getWeekRange(now); return d >= start && d < end; }
  if (period === 'this_month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === 'this_year') return d.getFullYear() === now.getFullYear();
  if (period === 'custom' && from && to) return d >= new Date(from + 'T00:00:00') && d <= new Date(to + 'T23:59:59');
  return false;
}

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;

// Custom label: shows $ amount + % of bruto above each bar
const CustomLabel = ({ x, y, width, value, bruto }: any) => {
  if (!value || value === 0) return null;
  const pct = bruto > 0 ? Math.round((value / bruto) * 100) : 0;
  return (
    <g>
      <text x={x + width / 2} y={y - 16} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))" fontWeight="700">
        {fmt(value)}
      </text>
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight="600">
        {pct}%
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold">${Number(entry.value).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
};

// Sub-chart for each segment
function SegmentChart({ title, data, bruto }: { title: string; data: { name: string; value: number; color: string }[]; bruto: number }) {
  const chartData = [data.reduce((acc, d) => ({ ...acc, [d.name]: d.value }), { segment: title })];
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 36, right: 8, left: 8, bottom: 4 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="segment" hide />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} />
          {data.map(d => (
            <Bar key={d.name} dataKey={d.name} fill={d.color} radius={[4, 4, 0, 0]} maxBarSize={50}>
              <LabelList content={(props: any) => <CustomLabel {...props} bruto={bruto} />} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* Mini legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {data.map(d => (
          <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RevenueBySegmentChart({ loads, drivers, dispatchers, expenses }: Props) {
  const [period, setPeriod] = useState<Period>('this_week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [truckDriverMap, setTruckDriverMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('drivers' as any).select('id, truck_id').eq('service_type', 'company_driver').then(({ data }) => {
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((d: any) => { if (d.truck_id) map[d.id] = d.truck_id; });
      setTruckDriverMap(map);
    });
  }, []);

  const segments = useMemo(() => {
    const periodLoads = loads.filter(l => l.status !== 'cancelled' && l.pickup_date && isInPeriod(l.pickup_date, period, customFrom, customTo));
    const periodExpenses = expenses.filter(e => e.expense_date && isInPeriod(e.expense_date, period, customFrom, customTo));

    // CAMIONES PROPIOS
    const cdLoads = periodLoads.filter(l => drivers.find(d => d.id === l.driver_id)?.service_type === 'company_driver');
    const cdBruto = cdLoads.reduce((s, l) => s + l.total_rate, 0);
    const cdDriverPay = cdLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      return s + (dr ? l.total_rate * (dr.pay_percentage / 100) : 0);
    }, 0);
    const cdTruckIds = new Set(cdLoads.map(l => truckDriverMap[l.driver_id || '']).filter(Boolean));
    const cdGastos = periodExpenses.filter(e => e.truck_id && cdTruckIds.has(e.truck_id)).reduce((s, e) => s + e.total_amount, 0);
    const cdNeto = Math.max(0, cdBruto - cdDriverPay - cdGastos);

    // OWNER OPERATORS
    const ooLoads = periodLoads.filter(l => drivers.find(d => d.id === l.driver_id)?.service_type === 'owner_operator');
    const ooBruto = ooLoads.reduce((s, l) => s + l.total_rate, 0);
    const ooDriverPay = ooLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      return s + (dr ? l.total_rate * ((dr.pay_percentage || 0) / 100) : 0);
    }, 0);
    const ooInvestor = ooLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      return s + (dr ? l.total_rate * ((dr.investor_pay_percentage || 0) / 100) : 0);
    }, 0);
    const ooDispatcher = ooLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      const disp = dispatchers.find(d => d.id === dr?.dispatcher_id);
      return s + (disp ? l.total_rate * ((disp.commission_percentage || 0) / 100) : 0);
    }, 0);
    const ooNeto = Math.max(0, ooBruto - ooDriverPay - ooInvestor - ooDispatcher);

    // SERVICIO DISPATCHER
    const dsLoads = periodLoads.filter(l => drivers.find(d => d.id === l.driver_id)?.service_type === 'dispatch_service');
    const dsBruto = dsLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      const disp = dispatchers.find(d => d.id === dr?.dispatcher_id);
      return s + l.total_rate * ((disp?.dispatch_service_percentage || 0) / 100);
    }, 0);
    const dsDispatcher = dsLoads.reduce((s, l) => {
      const dr = drivers.find(d => d.id === l.driver_id);
      const disp = dispatchers.find(d => d.id === dr?.dispatcher_id);
      return s + l.total_rate * ((disp?.commission_percentage || 0) / 100);
    }, 0);
    const dsNeto = Math.max(0, dsBruto - dsDispatcher);

    return {
      cd: { bruto: Math.round(cdBruto), driverPay: Math.round(cdDriverPay), gastos: Math.round(cdGastos), neto: Math.round(cdNeto) },
      oo: { bruto: Math.round(ooBruto), driverPay: Math.round(ooDriverPay), investor: Math.round(ooInvestor), dispatcher: Math.round(ooDispatcher), neto: Math.round(ooNeto) },
      ds: { bruto: Math.round(dsBruto), dispatcher: Math.round(dsDispatcher), neto: Math.round(dsNeto) },
    };
  }, [loads, drivers, dispatchers, expenses, period, customFrom, customTo, truckDriverMap]);

  const totalGross = segments.cd.bruto + segments.oo.bruto + segments.ds.bruto;
  const totalNet = segments.cd.neto + segments.oo.neto + segments.ds.neto;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Ingresos por Segmento</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bruto total: <span className="font-semibold text-foreground">${totalGross.toLocaleString()}</span>
              {' · '}
              Neto total: <span className="font-semibold text-green-600">${totalNet.toLocaleString()}</span>
            </p>
          </div>
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 mt-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-background" />
            <span className="text-xs text-muted-foreground">a</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-background" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Camiones Propios */}
          <SegmentChart
            title="Camiones Propios"
            bruto={segments.cd.bruto}
            data={[
              { name: 'Bruto', value: segments.cd.bruto, color: COLORS.bruto },
              { name: 'Pago Drivers', value: segments.cd.driverPay, color: COLORS.drivers },
              { name: 'Gastos', value: segments.cd.gastos, color: COLORS.gastos },
              { name: 'Neto', value: segments.cd.neto, color: COLORS.neto },
            ]}
          />
          {/* Owner Operators */}
          <div className="pt-6 md:pt-0 md:pl-6">
            <SegmentChart
              title="Owner Operators"
              bruto={segments.oo.bruto}
              data={[
                { name: 'Bruto', value: segments.oo.bruto, color: COLORS.bruto },
                { name: 'Pago Drivers', value: segments.oo.driverPay, color: COLORS.drivers },
                { name: 'Investor', value: segments.oo.investor, color: COLORS.investor },
                { name: 'Dispatcher', value: segments.oo.dispatcher, color: COLORS.dispatcher },
                { name: 'Neto', value: segments.oo.neto, color: COLORS.neto },
              ]}
            />
          </div>
          {/* Servicio Dispatcher */}
          <div className="pt-6 md:pt-0 md:pl-6">
            <SegmentChart
              title="Servicio Dispatcher"
              bruto={segments.ds.bruto}
              data={[
                { name: 'Bruto', value: segments.ds.bruto, color: COLORS.bruto },
                { name: 'Pago Dispatcher', value: segments.ds.dispatcher, color: COLORS.dispatcher },
                { name: 'Neto', value: segments.ds.neto, color: COLORS.neto },
              ]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

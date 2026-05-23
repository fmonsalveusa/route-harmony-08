import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

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

function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function isInPeriod(dateStr: string, period: Period, customFrom: string, customTo: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();

  if (period === 'this_week') {
    const { start, end } = getWeekRange(now);
    return d >= start && d < end;
  }
  if (period === 'this_month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (period === 'this_year') {
    return d.getFullYear() === now.getFullYear();
  }
  if (period === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom + 'T00:00:00');
    const to = new Date(customTo + 'T23:59:59');
    return d >= from && d <= to;
  }
  return false;
}

const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'Esta semana',
  this_month: 'Este mes',
  this_year: 'Este año',
  custom: 'Personalizado',
};

const formatCurrency = (value: number) =>
  value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1">
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

export function RevenueBySegmentChart({ loads, drivers, dispatchers, expenses }: Props) {
  const [period, setPeriod] = useState<Period>('this_week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [truckDriverMap, setTruckDriverMap] = useState<Record<string, string>>({});

  // Fetch truck_id for company drivers (needed for expense matching)
  useEffect(() => {
    supabase
      .from('drivers' as any)
      .select('id, truck_id')
      .eq('service_type', 'company_driver')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        ((data as any[]) || []).forEach((d: any) => {
          if (d.truck_id) map[d.id] = d.truck_id;
        });
        setTruckDriverMap(map);
      });
  }, []);

  const data = useMemo(() => {
    const periodLoads = loads.filter(l =>
      l.status !== 'cancelled' &&
      l.pickup_date &&
      isInPeriod(l.pickup_date, period, customFrom, customTo)
    );

    // Expenses in period (for company driver trucks)
    const periodExpenses = expenses.filter(e =>
      e.expense_date && isInPeriod(e.expense_date, period, customFrom, customTo)
    );

    // --- CAMIONES PROPIOS ---
    const cdLoads = periodLoads.filter(l => {
      const driver = drivers.find(d => d.id === l.driver_id);
      return driver?.service_type === 'company_driver';
    });

    const cdGross = cdLoads.reduce((s, l) => s + l.total_rate, 0);

    // Driver pay deduction
    const cdDriverPay = cdLoads.reduce((s, l) => {
      const driver = drivers.find(d => d.id === l.driver_id);
      if (!driver) return s;
      return s + (l.total_rate * (driver.pay_percentage / 100));
    }, 0);

    // Expenses for company driver trucks in period
    const cdTruckIds = new Set(
      cdLoads
        .map(l => truckDriverMap[l.driver_id || ''])
        .filter(Boolean)
    );
    const cdExpenses = periodExpenses
      .filter(e => e.truck_id && cdTruckIds.has(e.truck_id))
      .reduce((s, e) => s + e.total_amount, 0);

    const cdNet = cdGross - cdDriverPay - cdExpenses;

    // --- OWNER OPERATORS ---
    const ooLoads = periodLoads.filter(l => {
      const driver = drivers.find(d => d.id === l.driver_id);
      return driver?.service_type === 'owner_operator';
    });

    const ooGross = ooLoads.reduce((s, l) => s + l.total_rate, 0);

    const ooNet = ooLoads.reduce((s, l) => {
      const driver = drivers.find(d => d.id === l.driver_id);
      if (!driver) return s + l.total_rate;
      const driverPay = l.total_rate * ((driver.pay_percentage || 0) / 100);
      const investorPay = l.total_rate * ((driver.investor_pay_percentage || 0) / 100);
      // Dispatcher commission for this driver's dispatcher
      const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);
      const dispatcherPay = l.total_rate * ((dispatcher?.commission_percentage || 0) / 100);
      return s + (l.total_rate - driverPay - investorPay - dispatcherPay);
    }, 0);

    // --- SERVICIO DE DISPATCHER ---
    const dsLoads = periodLoads.filter(l => {
      const driver = drivers.find(d => d.id === l.driver_id);
      return driver?.service_type === 'dispatch_service';
    });

    const dsGross = dsLoads.reduce((s, l) => {
      const driver = drivers.find(d => d.id === l.driver_id);
      const dispatcher = dispatchers.find(d => d.id === driver?.dispatcher_id);
      const pct = (dispatcher?.dispatch_service_percentage || 0) / 100;
      return s + (l.total_rate * pct);
    }, 0);

    const dsNet = dsLoads.reduce((s, l) => {
      const driver = drivers.find(d => d.id === l.driver_id);
      const dispatcher = dispatchers.find(d => d.id === driver?.dispatcher_id);
      const dispatchFeePct = (dispatcher?.dispatch_service_percentage || 0) / 100;
      const commissionPct = (dispatcher?.commission_percentage || 0) / 100;
      const gross = l.total_rate * dispatchFeePct;
      const dispatcherPay = l.total_rate * commissionPct;
      return s + (gross - dispatcherPay);
    }, 0);

    return [
      {
        name: 'Camiones Propios',
        Bruto: Math.round(cdGross),
        Neto: Math.round(Math.max(0, cdNet)),
      },
      {
        name: 'Owner Operators',
        Bruto: Math.round(ooGross),
        Neto: Math.round(Math.max(0, ooNet)),
      },
      {
        name: 'Servicio Dispatcher',
        Bruto: Math.round(dsGross),
        Neto: Math.round(Math.max(0, dsNet)),
      },
    ];
  }, [loads, drivers, dispatchers, expenses, period, customFrom, customTo, truckDriverMap]);

  const totalGross = data.reduce((s, d) => s + d.Bruto, 0);
  const totalNet = data.reduce((s, d) => s + d.Neto, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Ingresos por Segmento</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bruto: <span className="font-semibold text-foreground">${totalGross.toLocaleString()}</span>
              {' · '}
              Neto: <span className="font-semibold text-green-600">${totalNet.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-8 text-xs border rounded-md px-2 bg-background"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-8 text-xs border rounded-md px-2 bg-background"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
            <Bar dataKey="Bruto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
            <Bar dataKey="Neto" fill="hsl(142, 60%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

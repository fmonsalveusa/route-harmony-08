import { useState, useMemo } from 'react';
import { useLoads } from '@/hooks/useLoads';
import { useExpenses } from '@/hooks/useExpenses';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell, LineChart, Line, PieChart, Pie, Tooltip, Legend } from 'recharts';
import { DollarSign, Receipt, Trophy, Truck, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Eye, Download, Settings, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FleetPerformance } from '@/components/performance/FleetPerformance';
import { FILTER_CHIP } from '@/components/FilterChip';

const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e3e3e3', boxShadow: '0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)', fontSize: 12 };
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format, subMonths, subWeeks, subYears } from 'date-fns';

type PeriodKey = 'week' | 'prev_week' | 'month' | 'prev_month' | 'last_3_months' | 'year';

function getDateRange(period: PeriodKey) {
  const now = new Date();
  switch (period) {
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'prev_week': { const p = subWeeks(now, 1); return { start: startOfWeek(p, { weekStartsOn: 1 }), end: endOfWeek(p, { weekStartsOn: 1 }) }; }
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'prev_month': { const p = subMonths(now, 1); return { start: startOfMonth(p), end: endOfMonth(p) }; }
    case 'last_3_months': return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now) };
  }
}

function getPrevDateRange(period: PeriodKey) {
  const now = new Date();
  switch (period) {
    case 'week': { const prev = subWeeks(now, 1); return { start: startOfWeek(prev, { weekStartsOn: 1 }), end: endOfWeek(prev, { weekStartsOn: 1 }) }; }
    case 'prev_week': { const prev = subWeeks(now, 2); return { start: startOfWeek(prev, { weekStartsOn: 1 }), end: endOfWeek(prev, { weekStartsOn: 1 }) }; }
    case 'month': { const prev = subMonths(now, 1); return { start: startOfMonth(prev), end: endOfMonth(prev) }; }
    case 'prev_month': { const prev = subMonths(now, 2); return { start: startOfMonth(prev), end: endOfMonth(prev) }; }
    case 'last_3_months': { const prev = subMonths(now, 5); return { start: startOfMonth(prev), end: endOfMonth(subMonths(now, 3)) }; }
    case 'year': { const prev = subYears(now, 1); return { start: startOfYear(prev), end: endOfYear(prev) }; }
  }
}

function pctChange(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / Math.abs(prev)) * 100;
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => n.toFixed(1) + '%';

const periodOptions: { value: PeriodKey; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'prev_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'prev_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
];

/** Performance: Rendimiento de la flota (todos los camiones, sin gastos) y P&L de Company Drivers */
export default function Performance() {
  const [view, setView] = useState<'fleet' | 'pl'>('fleet');
  return (
    <div className="space-y-3">
      <div className="flex border-b border-[#e3e3e3] dark:border-border">
        {([['fleet', 'Rendimiento por camión'], ['pl', 'P&L Company Drivers']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={cn('h-11 px-4 -mb-px border-b-[3px] text-sm font-medium transition-colors',
              view === k ? 'border-[#0b57d0] text-[#0b57d0] dark:text-blue-300' : 'border-transparent text-[#444746] dark:text-muted-foreground hover:text-[#1f1f1f]')}>
            {l}
          </button>
        ))}
      </div>
      {view === 'fleet' ? (
        <>
          <div>
            <h1 className="page-header flex items-center gap-3"><span className="page-icon"><Trophy className="h-5 w-5" /></span>Rendimiento por camión</h1>
            <p className="page-description pl-[52px]">Facturado, $/milla, millas vacías y días parado — sin gastos, solo lo que el sistema ya registra</p>
          </div>
          <FleetPerformance />
        </>
      ) : <PerformancePL />}
    </div>
  );
}

function PerformancePL() {
  const { loads } = useLoads();
  const { expenses } = useExpenses();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const { getPeriodFixedCosts, fixedCosts } = useTruckFixedCosts();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [breakdownBase, setBreakdownBase] = useState<'expenses' | 'revenue'>('expenses');

  const { start, end } = getDateRange(period);
  const prev = getPrevDateRange(period);

  // Only company drivers (service_type === 'company_driver')
  const companyDrivers = useMemo(() => drivers.filter(d => d.service_type === 'company_driver'), [drivers]);
  const companyDriverIds = useMemo(() => new Set(companyDrivers.map(d => d.id)), [companyDrivers]);
  // Trucks assigned to company drivers
  const companyTruckIds = useMemo(() => {
    const ids = new Set<string>();
    companyDrivers.forEach(d => { if (d.truck_id) ids.add(d.truck_id); });
    trucks.forEach(t => { if (t.driver_id && companyDriverIds.has(t.driver_id)) ids.add(t.id); });
    return ids;
  }, [companyDrivers, companyDriverIds, trucks]);

  const companyTrucks = useMemo(() => trucks.filter(t => companyTruckIds.has(t.id)), [trucks, companyTruckIds]);

  // Filter loads by period and company driver trucks
  const filterByPeriod = (dateStr: string | null, s: Date, e: Date) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: s, end: e }); } catch { return false; }
  };

  const periodLoads = useMemo(() =>
    loads.filter(l => {
      const driverId = l.driver_id;
      const truckId = l.truck_id;
      const isCompany = (driverId && companyDriverIds.has(driverId)) || (truckId && companyTruckIds.has(truckId));
      if (!isCompany) return false;
      if (l.status === 'cancelled') return false;
      return filterByPeriod(l.delivery_date || l.pickup_date || l.created_at, start, end);
    }), [loads, companyDriverIds, companyTruckIds, start, end]);

  const prevPeriodLoads = useMemo(() =>
    loads.filter(l => {
      const driverId = l.driver_id;
      const truckId = l.truck_id;
      const isCompany = (driverId && companyDriverIds.has(driverId)) || (truckId && companyTruckIds.has(truckId));
      if (!isCompany) return false;
      if (l.status === 'cancelled') return false;
      return filterByPeriod(l.delivery_date || l.pickup_date || l.created_at, prev.start, prev.end);
    }), [loads, companyDriverIds, companyTruckIds, prev]);

  const periodExpenses = useMemo(() =>
    expenses.filter(e => companyTruckIds.has(e.truck_id || '') && filterByPeriod(e.expense_date, start, end)),
    [expenses, companyTruckIds, start, end]);

  const prevPeriodExpenses = useMemo(() =>
    expenses.filter(e => companyTruckIds.has(e.truck_id || '') && filterByPeriod(e.expense_date, prev.start, prev.end)),
    [expenses, companyTruckIds, prev]);

  // Per-truck performance
  const truckPerformance = useMemo(() => {
    return companyTrucks.map(truck => {
      const driver = companyDrivers.find(d => d.id === truck.driver_id || d.truck_id === truck.id);
      const truckLoads = periodLoads.filter(l => l.truck_id === truck.id || (driver && l.driver_id === driver.id));
      const truckExpenses = periodExpenses.filter(e => e.truck_id === truck.id);

      const revenue = truckLoads.reduce((s, l) => s + (l.total_rate || 0), 0);
      const totalExpenses = truckExpenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      const dispatcherPay = truckLoads.reduce((s, l) => s + (l.dispatcher_pay_amount || 0), 0);
      const driverPay = truckLoads.reduce((s, l) => s + (l.driver_pay_amount || 0), 0);

      // Fixed costs (period-adjusted)
      const fixedCostsPeriod = (period === 'prev_week' || period === 'week') ? 'week' : (period === 'year') ? 'year' : 'month';
      const fixedCostsAmount = getPeriodFixedCosts(truck.id, fixedCostsPeriod) * (period === 'last_3_months' ? 3 : 1);

      // Factoring % from driver
      const factoringPct = driver?.factoring_percentage || 0;
      const factoringAmount = revenue * (factoringPct / 100);

      const allCosts = totalExpenses + dispatcherPay + driverPay + fixedCostsAmount + factoringAmount;
      const netProfit = revenue - allCosts;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      const loadsCompleted = truckLoads.length;
      const avgPerLoad = loadsCompleted > 0 ? netProfit / loadsCompleted : 0;

      // Expense breakdown
      const fuel = truckExpenses.filter(e => e.expense_type === 'fuel').reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      const maintenance = truckExpenses.filter(e => e.expense_type === 'maintenance').reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      const repairs = truckExpenses.filter(e => e.expense_type === 'repairs').reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      const otherExp = totalExpenses - fuel - maintenance - repairs;

      return {
        truckId: truck.id,
        unitNumber: truck.unit_number,
        plate: truck.license_plate || '-',
        model: truck.model || truck.truck_type || '-',
        make: truck.make || '',
        year: truck.year,
        driverName: driver?.name || 'Unassigned',
        driverId: driver?.id,
        revenue,
        fixedCosts: fixedCostsAmount,
        factoringPct,
        factoringAmount,
        totalExpenses: allCosts,
        rawExpenses: totalExpenses,
        dispatcherPay,
        driverPay,
        netProfit,
        margin,
        loadsCompleted,
        avgPerLoad,
        fuel,
        maintenance,
        repairs,
        otherExp,
      };
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [companyTrucks, companyDrivers, periodLoads, periodExpenses, getPeriodFixedCosts, period]);

  // Summary totals
  const totalRevenue = truckPerformance.reduce((s, t) => s + t.revenue, 0);
  const totalExpensesSum = truckPerformance.reduce((s, t) => s + t.totalExpenses, 0);
  const totalProfit = totalRevenue - totalExpensesSum;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalLoads = truckPerformance.reduce((s, t) => s + t.loadsCompleted, 0);
  const avgPerTruck = companyTrucks.length > 0 ? totalProfit / companyTrucks.length : 0;
  const bestTruck = truckPerformance.length > 0 ? truckPerformance[0].netProfit : 0;
  const worstTruck = truckPerformance.length > 0 ? truckPerformance[truckPerformance.length - 1].netProfit : 0;

  // Previous period totals for trends
  const prevRevenue = prevPeriodLoads.reduce((s, l) => s + (l.total_rate || 0), 0);
  const prevExpensesTotal = prevPeriodExpenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0) +
    prevPeriodLoads.reduce((s, l) => s + (l.dispatcher_pay_amount || 0) + (l.driver_pay_amount || 0), 0);
  const prevProfit = prevRevenue - prevExpensesTotal;

  const revenueTrend = pctChange(totalRevenue, prevRevenue);
  const expenseTrend = pctChange(totalExpensesSum, prevExpensesTotal);
  const profitTrend = pctChange(totalProfit, prevProfit);

  // Chart data
  const profitLossChartData = truckPerformance.map(t => ({
    name: `#${t.unitNumber}`,
    profit: t.netProfit,
    fill: t.netProfit >= 0 ? '#188038' : '#d93025',
  }));

  const revenueVsExpensesData = truckPerformance.map(t => ({
    name: `#${t.unitNumber}`,
    Revenue: t.revenue,
    Fuel: t.fuel,
    Maintenance: t.maintenance,
    Repairs: t.repairs,
    'Dispatcher Pay': t.dispatcherPay,
    'Driver Pay': t.driverPay,
    Other: t.otherExp,
  }));

  // Expense breakdown totals
  const totalFuel = truckPerformance.reduce((s, t) => s + t.fuel, 0);
  const totalMaint = truckPerformance.reduce((s, t) => s + t.maintenance, 0);
  const totalRepairs = truckPerformance.reduce((s, t) => s + t.repairs, 0);
  const totalDispPay = truckPerformance.reduce((s, t) => s + t.dispatcherPay, 0);
  const totalDriverPay = truckPerformance.reduce((s, t) => s + t.driverPay, 0);
  const totalOther = truckPerformance.reduce((s, t) => s + t.otherExp, 0);
  const totalFactoring = truckPerformance.reduce((s, t) => s + t.factoringAmount, 0);

  const expenseBreakdownData = [
    { name: 'Fuel', value: totalFuel, fill: '#e37400' },
    { name: 'Maintenance', value: totalMaint, fill: '#0b57d0' },
    { name: 'Repairs', value: totalRepairs, fill: '#d93025' },
    { name: 'Dispatcher Pay', value: totalDispPay, fill: '#8e24aa' },
    { name: 'Driver Pay', value: totalDriverPay, fill: '#188038' },
    { name: 'Factoring', value: totalFactoring, fill: '#f9ab00' },
    { name: 'Other', value: totalOther, fill: '#5f6368' },
  ].filter(d => d.value > 0);

  // Margin distribution
  const highProfit = truckPerformance.filter(t => t.margin > 30).length;
  const medProfit = truckPerformance.filter(t => t.margin > 10 && t.margin <= 30).length;
  const lowProfit = truckPerformance.filter(t => t.margin > 0 && t.margin <= 10).length;
  const lossCount = truckPerformance.filter(t => t.margin <= 0).length;
  const profitableCount = truckPerformance.filter(t => t.netProfit > 0).length;

  const marginDistData = [
    { name: 'High (>30%)', value: highProfit, fill: '#188038' },
    { name: 'Medium (10-30%)', value: medProfit, fill: '#f9ab00' },
    { name: 'Low (0-10%)', value: lowProfit, fill: '#e37400' },
    { name: 'Loss (<0%)', value: lossCount, fill: '#d93025' },
  ].filter(d => d.value > 0);

  // Insights
  const insights: { icon: string; text: string; type: 'good' | 'warn' | 'info' }[] = [];
  if (truckPerformance.length > 0) {
    const top = truckPerformance[0];
    insights.push({ icon: '✓', text: `Truck #${top.unitNumber} is your top performer with ${fmt(top.netProfit)} profit`, type: 'good' });
    const lossTrucks = truckPerformance.filter(t => t.netProfit < 0);
    if (lossTrucks.length > 0) {
      insights.push({ icon: '⚠', text: `${lossTrucks.length} truck(s) operating at a loss. Review costs.`, type: 'warn' });
    }
    if (profitTrend > 0) {
      insights.push({ icon: '📈', text: `Overall profit increased ${fmtPct(Math.abs(profitTrend))} compared to last period`, type: 'good' });
    } else if (profitTrend < 0) {
      insights.push({ icon: '📉', text: `Overall profit decreased ${fmtPct(Math.abs(profitTrend))} compared to last period`, type: 'warn' });
    }
    if (totalFuel > 0 && totalExpensesSum > 0) {
      const fuelPct = (totalFuel / totalExpensesSum) * 100;
      if (fuelPct > 40) {
        insights.push({ icon: '💡', text: `Fuel costs are ${fmtPct(fuelPct)} of total expenses. Consider fuel efficiency strategies.`, type: 'info' });
      }
    }
    if (profitableCount === companyTrucks.length && companyTrucks.length > 0) {
      insights.push({ icon: '🟢', text: `All ${companyTrucks.length} trucks are profitable this period!`, type: 'good' });
    }
  }

  const getRankIcon = (i: number) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `${i + 1}`;
  };

  // Franja de color a la izquierda según el margen (en vez de pintar toda la fila)
  const getRowHighlight = (margin: number) => {
    if (margin > 30) return 'border-l-[#188038]';
    if (margin > 10) return 'border-l-[#f9ab00]';
    if (margin > 0) return 'border-l-[#e37400]';
    return 'border-l-[#d93025]';
  };

  const getStatusBadge = (profit: number, margin: number) => {
    const pill = (label: string, cls: string) => <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white whitespace-nowrap', cls)}>{label}</span>;
    if (profit > 0 && margin > 10) return pill('Profitable', 'bg-[#188038]');
    if (profit > 0) return pill('Low Margin', 'bg-[#e37400]');
    if (profit === 0) return pill('Break-even', 'bg-[#5f6368]');
    return pill('Loss', 'bg-[#d93025]');
  };

  const dateRangeLabel = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;

  const PCARD = 'rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border overflow-hidden card-3d-strong';
  const PTITLE = 'text-base font-medium text-[#1f1f1f] dark:text-foreground';
  const trendChip = (good: boolean, value: number, up: boolean) => (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
      good ? 'bg-[#e6f4ea] text-[#0d652d] dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-[#fce8e6] text-[#a50e0e] dark:bg-red-950/40 dark:text-red-300')}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmtPct(Math.abs(value))} vs last {period}
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-3">
            <span className="page-icon"><Trophy className="h-5 w-5" /></span>
            Performance
          </h1>
          <p className="page-description pl-[52px]">Profit & Loss Analysis by Truck — Company Drivers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
            <SelectTrigger className={cn(FILTER_CHIP, 'min-w-[150px]')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="inline-flex items-center gap-1.5 h-9 rounded-full bg-[#e8f0fe] dark:bg-blue-950/40 px-3 text-xs font-medium text-[#0b57d0] dark:text-blue-300">
            <CalendarDays className="h-3.5 w-3.5" /> {dateRangeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 h-9 rounded-full bg-[#f0f4f9] dark:bg-muted/60 px-3 text-xs font-medium text-[#444746] dark:text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> {companyTrucks.length} trucks
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Revenue */}
        <div className="stat-tile-3d rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200">
              <DollarSign className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Total Revenue</p>
              <p className="text-[28px] leading-8 font-normal text-[#188038] dark:text-emerald-400">{fmt(totalRevenue)}</p>
              <p className="text-xs text-[#444746] dark:text-muted-foreground">From {totalLoads} loads</p>
              {trendChip(revenueTrend >= 0, revenueTrend, revenueTrend >= 0)}
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="stat-tile-3d rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Total Expenses</p>
              <p className="text-[28px] leading-8 font-normal text-[#d93025] dark:text-red-400">{fmt(totalExpensesSum)}</p>
              <p className="text-xs text-[#444746] dark:text-muted-foreground">Fuel {fmt(totalFuel)} · Maint {fmt(totalMaint)} · Other {fmt(totalOther)}</p>
              {trendChip(expenseTrend <= 0, expenseTrend, expenseTrend > 0)}
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="stat-tile-3d rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200">
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Net Profit</p>
              <p className={cn('text-[28px] leading-8 font-normal', totalProfit >= 0 ? 'text-[#0b57d0] dark:text-blue-300' : 'text-[#d93025]')}>{fmt(totalProfit)}</p>
              <p className="text-xs text-[#444746] dark:text-muted-foreground">{fmtPct(totalMargin)} margin</p>
              {trendChip(profitTrend >= 0, profitTrend, profitTrend >= 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className={PCARD}>
        <div className="px-5 pt-4 pb-3">
          <h3 className={PTITLE}>Truck Performance Summary</h3>
          <p className="text-xs text-[#444746] dark:text-muted-foreground">Company Drivers Only — {periodOptions.find(o => o.value === period)?.label}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-[#e3e3e3] dark:border-border bg-[#f8fafd] dark:bg-muted/30">
                {['Rank', 'Truck', 'Driver', 'Revenue', 'Fixed Costs', 'Driver Pay', 'Dispatcher Pay', '% Factoring', 'Expenses', 'Net Profit', 'Margin', 'Loads', 'Avg/Load', 'Status'].map((h, idx) => (
                  <th key={h} className={cn('px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground whitespace-nowrap',
                    idx === 0 || idx === 11 || idx === 13 ? 'text-center' : idx >= 3 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {truckPerformance.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-[#444746] dark:text-muted-foreground">
                    No company driver trucks found for this period
                  </td>
                </tr>
              ) : (
                <>
                  {truckPerformance.map((t, i) => (
                    <tr key={t.truckId} className={cn('border-b border-[#f0f0f0] dark:border-border hover:bg-[#f8fafd] dark:hover:bg-muted/30 border-l-4', getRowHighlight(t.margin))}>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm',
                          i < 3 ? 'text-lg' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground font-medium')}>{getRankIcon(i)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200"><Truck className="h-4 w-4" /></span>
                          <div>
                            <div className="text-[15px] text-[#1f1f1f] dark:text-foreground whitespace-nowrap">Unit #{t.unitNumber}</div>
                            <div className="text-xs text-[#444746] dark:text-muted-foreground whitespace-nowrap">{t.make} {t.model} {t.year ? `(${t.year})` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#1f1f1f] dark:text-foreground whitespace-nowrap">{t.driverName}</td>
                      <td className="px-3 py-3 text-right font-medium text-[#1f1f1f] dark:text-foreground">{fmt(t.revenue)}</td>
                      <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(t.fixedCosts)}</td>
                      <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(t.driverPay)}</td>
                      <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(t.dispatcherPay)}</td>
                      <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">
                        <div>{fmt(t.factoringAmount)}</div>
                        <div className="text-[10px]">{fmtPct(t.factoringPct)}</div>
                      </td>
                      <td className="px-3 py-3 text-right text-[#d93025] dark:text-red-400">{fmt(t.totalExpenses)}</td>
                      <td className={cn('px-3 py-3 text-right text-base font-medium', t.netProfit >= 0 ? 'text-[#188038] dark:text-emerald-400' : 'text-[#d93025]')}>
                        {fmt(t.netProfit)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#1f1f1f] dark:text-foreground">{fmtPct(t.margin)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex min-w-[28px] h-6 items-center justify-center rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 px-2 text-xs font-medium text-[#041e49] dark:text-blue-200">{t.loadsCompleted}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-[#1f1f1f] dark:text-foreground">{fmt(t.avgPerLoad)}</td>
                      <td className="px-3 py-3 text-center">{getStatusBadge(t.netProfit, t.margin)}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-[#f0f4f9] dark:bg-muted/50 font-medium">
                    <td className="px-3 py-3 text-center text-[#444746]">—</td>
                    <td className="px-3 py-3 text-[#1f1f1f] dark:text-foreground whitespace-nowrap">TOTAL ({companyTrucks.length} trucks)</td>
                    <td className="px-3 py-3 text-[#444746]">—</td>
                    <td className="px-3 py-3 text-right text-[#1f1f1f] dark:text-foreground">{fmt(totalRevenue)}</td>
                    <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.fixedCosts, 0))}</td>
                    <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.driverPay, 0))}</td>
                    <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.dispatcherPay, 0))}</td>
                    <td className="px-3 py-3 text-right text-[#444746] dark:text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.factoringAmount, 0))}</td>
                    <td className="px-3 py-3 text-right text-[#d93025] dark:text-red-400">{fmt(totalExpensesSum)}</td>
                    <td className={cn('px-3 py-3 text-right text-base', totalProfit >= 0 ? 'text-[#188038] dark:text-emerald-400' : 'text-[#d93025]')}>{fmt(totalProfit)}</td>
                    <td className="px-3 py-3 text-right text-[#1f1f1f] dark:text-foreground">{fmtPct(totalMargin)}</td>
                    <td className="px-3 py-3 text-center text-[#1f1f1f] dark:text-foreground">{totalLoads}</td>
                    <td className="px-3 py-3 text-right text-[#1f1f1f] dark:text-foreground">{fmt(totalLoads > 0 ? totalProfit / totalLoads : 0)}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Profit/Loss by Truck */}
        <div className={PCARD}>
          <div className="px-5 pt-4 pb-1"><h3 className={PTITLE}>Profit/Loss by Truck</h3></div>
          <div className="px-3 pb-4">
            {profitLossChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, profitLossChartData.length * 40)}>
                <BarChart data={profitLossChartData} layout="vertical" margin={{ left: 10, right: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e3e3" />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#444746' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12, fill: '#444746' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="profit" radius={[0, 8, 8, 0]}>
                    {profitLossChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="profit" position="right" formatter={(v: number) => fmt(v)} style={{ fontSize: 12, fontWeight: 500, fill: '#0b57d0' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-[#444746] dark:text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* Revenue vs Expenses */}
        <div className={PCARD}>
          <div className="px-5 pt-4 pb-1"><h3 className={PTITLE}>Revenue vs Expenses by Truck</h3></div>
          <div className="px-3 pb-4">
            {revenueVsExpensesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueVsExpensesData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e3e3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#444746' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={[0, (max: number) => Math.ceil(max * 1.15)]} tick={{ fontSize: 12, fill: '#444746' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#0b57d0" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="Revenue" position="top" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 12, fontWeight: 500, fill: '#0b57d0' }} />
                  </Bar>
                  <Bar dataKey="Fuel" stackId="expenses" fill="#e37400">
                    <LabelList dataKey="Fuel" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 500, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Maintenance" stackId="expenses" fill="#f9ab00">
                    <LabelList dataKey="Maintenance" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 500, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Repairs" stackId="expenses" fill="#d93025">
                    <LabelList dataKey="Repairs" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 500, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Dispatcher Pay" stackId="expenses" fill="#8e24aa">
                    <LabelList dataKey="Dispatcher Pay" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 500, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Driver Pay" stackId="expenses" fill="#188038">
                    <LabelList dataKey="Driver Pay" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 500, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Other" stackId="expenses" fill="#5f6368" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-[#444746] dark:text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* Expense Breakdown Pie */}
        <div className={PCARD}>
          <div className="px-5 pt-4 pb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className={PTITLE}>Total Expense Breakdown</h3>
            {/* Botones segmentados estilo Google */}
            <div className="inline-flex rounded-full border border-[#747775] dark:border-border overflow-hidden text-xs font-medium">
              {([['expenses', '% of Expenses'], ['revenue', '% of Revenue']] as const).map(([v, l], idx) => (
                <button
                  key={v}
                  onClick={() => setBreakdownBase(v)}
                  className={cn('h-8 px-3 inline-flex items-center gap-1 transition-colors', idx > 0 && 'border-l border-[#747775] dark:border-border',
                    breakdownBase === v ? 'bg-[#c2e7ff] text-[#001d35] dark:bg-blue-900/50 dark:text-blue-100' : 'text-[#444746] dark:text-muted-foreground hover:bg-[#f0f4f9] dark:hover:bg-muted')}
                >
                  {breakdownBase === v && <CheckCircle className="h-3.5 w-3.5" />} {l}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 pb-4">
            {expenseBreakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseBreakdownData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={2}
                    stroke="none"
                    label={({ name, value }) => {
                      const base = breakdownBase === 'expenses' ? totalExpensesSum : totalRevenue;
                      const pct = base > 0 ? ((value / base) * 100).toFixed(0) : '0';
                      return `${name} ${pct}%`;
                    }}
                  >
                    {expenseBreakdownData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => {
                      const pctOfExpenses = totalExpensesSum > 0 ? ((v / totalExpensesSum) * 100).toFixed(1) : '0';
                      const pctOfRevenue = totalRevenue > 0 ? ((v / totalRevenue) * 100).toFixed(1) : '0';
                      return [
                        `${fmt(v)} — ${pctOfExpenses}% of expenses · ${pctOfRevenue}% of revenue`,
                        name,
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-[#444746] dark:text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* Margin Distribution Donut */}
        <div className={PCARD}>
          <div className="px-5 pt-4 pb-1"><h3 className={PTITLE}>Trucks by Profit Margin</h3></div>
          <div className="px-3 pb-4">
            {marginDistData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={marginDistData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={65}
                      paddingAngle={2}
                      stroke="none"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {marginDistData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-[28px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">{profitableCount}/{companyTrucks.length}</div>
                    <div className="text-xs text-[#444746] dark:text-muted-foreground">Profitable</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-[#444746] dark:text-muted-foreground">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div className={PCARD}>
          <div className="px-5 pt-4 pb-2">
            <h3 className={cn(PTITLE, 'flex items-center gap-2')}>
              <span className="h-8 w-8 rounded-full flex items-center justify-center bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /></span>
              Key Insights
            </h3>
          </div>
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {insights.map((ins, i) => (
              <div key={i} className={cn('flex items-start gap-2 px-4 py-3 rounded-2xl text-sm',
                ins.type === 'good' ? 'bg-[#e6f4ea] text-[#0d652d] dark:bg-emerald-950/40 dark:text-emerald-200' :
                ins.type === 'warn' ? 'bg-[#fef7e0] text-[#5f3a00] dark:bg-amber-950/40 dark:text-amber-200' :
                'bg-[#e8f0fe] text-[#041e49] dark:bg-blue-950/40 dark:text-blue-200')}>
                <span>{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

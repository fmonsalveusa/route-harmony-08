import { useState, useMemo } from 'react';
import { useLoads } from '@/hooks/useLoads';
import { useExpenses } from '@/hooks/useExpenses';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useTruckFixedCosts } from '@/hooks/useTruckFixedCosts';
import { FixedCostsDialog } from '@/components/FixedCostsDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell, LineChart, Line, PieChart, Pie, Tooltip, Legend } from 'recharts';
import { DollarSign, Receipt, Trophy, Truck, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Eye, Download, Settings } from 'lucide-react';
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

export default function Performance() {
  const { loads } = useLoads();
  const { expenses } = useExpenses();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const { getPeriodFixedCosts, fixedCosts } = useTruckFixedCosts();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [fixedCostsDialogOpen, setFixedCostsDialogOpen] = useState(false);
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
      const fixedCostsAmount = getPeriodFixedCosts(truck.id, period);

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
    fill: t.netProfit >= 0 ? 'hsl(152, 60%, 40%)' : 'hsl(0, 72%, 51%)',
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
    { name: 'Fuel', value: totalFuel, fill: 'hsl(28, 92%, 52%)' },
    { name: 'Maintenance', value: totalMaint, fill: 'hsl(217, 78%, 42%)' },
    { name: 'Repairs', value: totalRepairs, fill: 'hsl(0, 72%, 51%)' },
    { name: 'Dispatcher Pay', value: totalDispPay, fill: 'hsl(270, 50%, 50%)' },
    { name: 'Driver Pay', value: totalDriverPay, fill: 'hsl(152, 60%, 40%)' },
    { name: 'Factoring', value: totalFactoring, fill: 'hsl(45, 80%, 50%)' },
    { name: 'Other', value: totalOther, fill: 'hsl(218, 15%, 48%)' },
  ].filter(d => d.value > 0);

  // Margin distribution
  const highProfit = truckPerformance.filter(t => t.margin > 30).length;
  const medProfit = truckPerformance.filter(t => t.margin > 10 && t.margin <= 30).length;
  const lowProfit = truckPerformance.filter(t => t.margin > 0 && t.margin <= 10).length;
  const lossCount = truckPerformance.filter(t => t.margin <= 0).length;
  const profitableCount = truckPerformance.filter(t => t.netProfit > 0).length;

  const marginDistData = [
    { name: 'High (>30%)', value: highProfit, fill: 'hsl(152, 60%, 40%)' },
    { name: 'Medium (10-30%)', value: medProfit, fill: 'hsl(38, 92%, 50%)' },
    { name: 'Low (0-10%)', value: lowProfit, fill: 'hsl(28, 92%, 52%)' },
    { name: 'Loss (<0%)', value: lossCount, fill: 'hsl(0, 72%, 51%)' },
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

  const getRowHighlight = (margin: number) => {
    if (margin > 30) return 'bg-[hsl(152,60%,95%)]';
    if (margin > 10) return 'bg-[hsl(38,92%,95%)]';
    if (margin > 0) return 'bg-[hsl(28,92%,95%)]';
    return 'bg-[hsl(0,72%,96%)]';
  };

  const getStatusBadge = (profit: number, margin: number) => {
    if (profit > 0 && margin > 10) return <Badge className="bg-[hsl(152,60%,40%)] text-white">Profitable</Badge>;
    if (profit > 0) return <Badge className="bg-[hsl(38,92%,50%)] text-white">Low Margin</Badge>;
    if (profit === 0) return <Badge variant="outline">Break-even</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">Loss</Badge>;
  };

  const dateRangeLabel = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Trophy className="h-7 w-7 text-[hsl(38,92%,50%)]" />
            Performance
          </h1>
          <p className="page-description">Profit & Loss Analysis by Truck — Company Drivers</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{dateRangeLabel}</span>
          <Badge variant="outline" className="text-xs">{companyTrucks.length} trucks</Badge>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
        <TabsList className="bg-muted">
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="year">This Year</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Revenue */}
        <Card className="border-l-4 border-l-[hsl(152,60%,40%)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold tracking-tight text-[hsl(152,60%,40%)]">{fmt(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">From {totalLoads} loads</p>
                <p className={`text-xs font-medium flex items-center gap-1 ${revenueTrend >= 0 ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
                  {revenueTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmtPct(Math.abs(revenueTrend))} vs last {period}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(152,60%,90%)]">
                <DollarSign className="h-5 w-5 text-[hsl(152,60%,40%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold tracking-tight text-destructive">{fmt(totalExpensesSum)}</p>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>Fuel: {fmt(totalFuel)}</div>
                  <div>Maint: {fmt(totalMaint)} | Other: {fmt(totalOther)}</div>
                </div>
                <p className={`text-xs font-medium flex items-center gap-1 ${expenseTrend <= 0 ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
                  {expenseTrend <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {fmtPct(Math.abs(expenseTrend))} vs last {period}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(0,72%,93%)]">
                <Receipt className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-l-4 border-l-[hsl(38,92%,50%)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-3xl font-extrabold tracking-tight ${totalProfit >= 0 ? 'text-[hsl(38,92%,50%)]' : 'text-destructive'}`}>
                  {fmt(totalProfit)}
                </p>
                <p className="text-xs text-muted-foreground">{fmtPct(totalMargin)} margin</p>
                <p className={`text-xs font-medium flex items-center gap-1 ${profitTrend >= 0 ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
                  {profitTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmtPct(Math.abs(profitTrend))} vs last {period}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(38,92%,90%)]">
                <Trophy className="h-5 w-5 text-[hsl(38,92%,50%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Truck Performance Summary</CardTitle>
              <CardDescription>Company Drivers Only — {periodLabels[period]}</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setFixedCostsDialogOpen(true)}>
              <Settings className="h-4 w-4" />
              Fixed Costs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-14 text-center">Rank</TableHead>
                  <TableHead>Truck</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                   <TableHead className="text-right">Fixed Costs</TableHead>
                   <TableHead className="text-right">Driver Pay</TableHead>
                   <TableHead className="text-right">Dispatcher Pay</TableHead>
                  <TableHead className="text-right">% Factoring</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right font-bold">Net Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-center">Loads</TableHead>
                  <TableHead className="text-right">Avg/Load</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {truckPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                      No company driver trucks found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {truckPerformance.map((t, i) => (
                      <TableRow key={t.truckId} className={getRowHighlight(t.margin)}>
                        <TableCell className="text-center font-bold text-lg">{getRankIcon(i)}</TableCell>
                        <TableCell>
                          <div className="font-medium">#{t.unitNumber}</div>
                          <div className="text-xs text-muted-foreground">{t.make} {t.model} {t.year ? `(${t.year})` : ''}</div>
                        </TableCell>
                        <TableCell className="font-medium">{t.driverName}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(t.revenue)}</TableCell>
                         <TableCell className="text-right text-muted-foreground">{fmt(t.fixedCosts)}</TableCell>
                         <TableCell className="text-right text-muted-foreground">{fmt(t.driverPay)}</TableCell>
                         <TableCell className="text-right text-muted-foreground">{fmt(t.dispatcherPay)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <div className="text-sm">{fmt(t.factoringAmount)}</div>
                          <div className="text-[10px]">{fmtPct(t.factoringPct)}</div>
                        </TableCell>
                        <TableCell className="text-right text-destructive">{fmt(t.totalExpenses)}</TableCell>
                        <TableCell className={`text-right font-bold text-base ${t.netProfit >= 0 ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
                          {fmt(t.netProfit)}
                        </TableCell>
                        <TableCell className="text-right">{fmtPct(t.margin)}</TableCell>
                        <TableCell className="text-center">{t.loadsCompleted}</TableCell>
                        <TableCell className="text-right">{fmt(t.avgPerLoad)}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(t.netProfit, t.margin)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell className="text-center">—</TableCell>
                      <TableCell>TOTAL ({companyTrucks.length} trucks)</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-right">{fmt(totalRevenue)}</TableCell>
                       <TableCell className="text-right text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.fixedCosts, 0))}</TableCell>
                       <TableCell className="text-right text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.driverPay, 0))}</TableCell>
                       <TableCell className="text-right text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.dispatcherPay, 0))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(truckPerformance.reduce((s, t) => s + t.factoringAmount, 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(totalExpensesSum)}</TableCell>
                      <TableCell className={`text-right text-base ${totalProfit >= 0 ? 'text-[hsl(152,60%,40%)]' : 'text-destructive'}`}>
                        {fmt(totalProfit)}
                      </TableCell>
                      <TableCell className="text-right">{fmtPct(totalMargin)}</TableCell>
                      <TableCell className="text-center">{totalLoads}</TableCell>
                      <TableCell className="text-right">{fmt(totalLoads > 0 ? totalProfit / totalLoads : 0)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit/Loss by Truck */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profit/Loss by Truck</CardTitle>
          </CardHeader>
          <CardContent>
            {profitLossChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, profitLossChartData.length * 40)}>
                <BarChart data={profitLossChartData} layout="vertical" margin={{ left: 10, right: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                    {profitLossChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="profit" position="right" formatter={(v: number) => fmt(v)} style={{ fontSize: 12, fontWeight: 700, fill: '#1e3a5f' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue vs Expenses by Truck</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueVsExpensesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueVsExpensesData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="hsl(217, 78%, 42%)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Revenue" position="top" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 12, fontWeight: 700, fill: '#1e3a5f' }} />
                  </Bar>
                  <Bar dataKey="Fuel" stackId="expenses" fill="hsl(28, 92%, 52%)">
                    <LabelList dataKey="Fuel" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Maintenance" stackId="expenses" fill="hsl(38, 92%, 50%)">
                    <LabelList dataKey="Maintenance" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Repairs" stackId="expenses" fill="hsl(0, 72%, 51%)">
                    <LabelList dataKey="Repairs" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Dispatcher Pay" stackId="expenses" fill="hsl(270, 50%, 50%)">
                    <LabelList dataKey="Dispatcher Pay" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Driver Pay" stackId="expenses" fill="hsl(152, 60%, 40%)">
                    <LabelList dataKey="Driver Pay" position="center" formatter={(v: number) => v ? fmt(v) : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#ffffff' }} />
                  </Bar>
                  <Bar dataKey="Other" stackId="expenses" fill="hsl(218, 15%, 48%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Total Expense Breakdown</CardTitle>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
              <button
                onClick={() => setBreakdownBase('expenses')}
                className={`px-2 py-1 rounded-sm transition-colors ${breakdownBase === 'expenses' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                % of Expenses
              </button>
              <button
                onClick={() => setBreakdownBase('revenue')}
                className={`px-2 py-1 rounded-sm transition-colors ${breakdownBase === 'revenue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                % of Revenue
              </button>
            </div>
          </CardHeader>
          <CardContent>
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
                    innerRadius={50}
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
              <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Margin Distribution Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trucks by Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
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
                      innerRadius={60}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {marginDistData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{profitableCount}/{companyTrucks.length}</div>
                    <div className="text-xs text-muted-foreground">Profitable</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((ins, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm ${
                  ins.type === 'good' ? 'bg-[hsl(152,60%,96%)] border-[hsl(152,60%,80%)]' :
                  ins.type === 'warn' ? 'bg-[hsl(38,92%,96%)] border-[hsl(38,92%,80%)]' :
                  'bg-primary/5 border-primary/20'
                }`}>
                  <span className="mr-2">{ins.icon}</span>
                  {ins.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <FixedCostsDialog
        open={fixedCostsDialogOpen}
        onOpenChange={setFixedCostsDialogOpen}
        trucks={companyTrucks}
      />
    </div>
  );
}

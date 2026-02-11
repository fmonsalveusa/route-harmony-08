import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign, Fuel, Wrench, Receipt, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Download, FileSpreadsheet, FileText, FileDown, BarChart3,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { EXPENSE_TYPE_LABELS } from './expenseConstants';
import type { DbExpense } from '@/hooks/useExpenses';

interface TruckInfo {
  id: string;
  unit_number: string;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  driver_id: string | null;
}

interface DriverInfo {
  id: string;
  name: string;
  service_type: string;
  truck_id: string | null;
}

interface Props {
  expenses: DbExpense[];
  trucks: TruckInfo[];
  drivers: DriverInfo[];
}

const DONUT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6', '#eab308'];

export function ExpenseSummaryDashboard({ expenses, trucks, drivers }: Props) {
  const [open, setOpen] = useState(true);
  const [companyDriverOnly, setCompanyDriverOnly] = useState(false);
  const [truckPage, setTruckPage] = useState(1);
  const [truckSort, setTruckSort] = useState<'total' | 'fuel' | 'maintenance'>('total');
  const [truckSortDir, setTruckSortDir] = useState<'asc' | 'desc'>('desc');

  // Company driver truck IDs
  const companyDriverTruckIds = useMemo(() => new Set(
    trucks.filter(t => {
      const d = drivers.find(dr => dr.id === t.driver_id);
      return d && d.service_type === 'company_driver';
    }).map(t => t.id)
  ), [trucks, drivers]);

  // Filter expenses for company drivers if toggle is ON
  const filteredExpenses = useMemo(() => {
    if (!companyDriverOnly) return expenses;
    return expenses.filter(e => e.truck_id && companyDriverTruckIds.has(e.truck_id));
  }, [expenses, companyDriverOnly, companyDriverTruckIds]);

  // Count unique trucks in filtered data
  const filteredTruckCount = useMemo(() => {
    const ids = new Set(filteredExpenses.filter(e => e.truck_id).map(e => e.truck_id));
    return ids.size;
  }, [filteredExpenses]);

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.total_amount, 0);
  const fuelExpenses = filteredExpenses.filter(e => e.expense_type === 'fuel');
  const fuelTotal = fuelExpenses.reduce((s, e) => s + e.total_amount, 0);
  const maintRepairExpenses = filteredExpenses.filter(e => ['maintenance', 'repairs'].includes(e.expense_type));
  const maintTotal = maintRepairExpenses.reduce((s, e) => s + e.total_amount, 0);
  const otherTotal = totalExpenses - fuelTotal - maintTotal;

  const fuelPct = totalExpenses > 0 ? ((fuelTotal / totalExpenses) * 100).toFixed(0) : '0';
  const maintPct = totalExpenses > 0 ? ((maintTotal / totalExpenses) * 100).toFixed(0) : '0';
  const otherPct = totalExpenses > 0 ? ((otherTotal / totalExpenses) * 100).toFixed(0) : '0';
  const avgFuelTx = fuelExpenses.length > 0 ? fuelTotal / fuelExpenses.length : 0;

  // --- Donut chart data ---
  const donutData = useMemo(() => {
    const byType: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      byType[e.expense_type] = (byType[e.expense_type] || 0) + e.total_amount;
    });
    return Object.entries(byType)
      .map(([type, amount]) => ({
        name: EXPENSE_TYPE_LABELS[type] || type,
        value: amount,
        pct: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, totalExpenses]);

  // --- Top trucks bar chart ---
  const truckBarData = useMemo(() => {
    const byTruck: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      if (e.truck_id) byTruck[e.truck_id] = (byTruck[e.truck_id] || 0) + e.total_amount;
    });
    return Object.entries(byTruck)
      .map(([truckId, total]) => {
        const t = trucks.find(tr => tr.id === truckId);
        return {
          name: t ? `#${t.unit_number}` : 'Unknown',
          total: Math.round(total),
          color: total > 2500 ? '#ef4444' : total > 1000 ? '#eab308' : '#22c55e',
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredExpenses, trucks]);

  // --- Truck breakdown table ---
  const truckTableData = useMemo(() => {
    const map: Record<string, {
      truckId: string; fuel: number; maintenance: number; repairs: number;
      tires: number; other: number; total: number; count: number; lastDate: string;
    }> = {};

    filteredExpenses.forEach(e => {
      if (!e.truck_id) return;
      if (!map[e.truck_id]) {
        map[e.truck_id] = { truckId: e.truck_id, fuel: 0, maintenance: 0, repairs: 0, tires: 0, other: 0, total: 0, count: 0, lastDate: e.expense_date };
      }
      const row = map[e.truck_id];
      row.total += e.total_amount;
      row.count++;
      if (e.expense_date > row.lastDate) row.lastDate = e.expense_date;
      if (e.expense_type === 'fuel') row.fuel += e.total_amount;
      else if (e.expense_type === 'maintenance') row.maintenance += e.total_amount;
      else if (e.expense_type === 'repairs') row.repairs += e.total_amount;
      else if (e.expense_type === 'tires') row.tires += e.total_amount;
      else row.other += e.total_amount;
    });

    let arr = Object.values(map).map(row => {
      const t = trucks.find(tr => tr.id === row.truckId);
      const d = t ? (drivers.find(dr => dr.id === t.driver_id) || drivers.find(dr => dr.truck_id === t.id)) : null;
      return {
        ...row,
        truck: t ? `#${t.unit_number}` : 'Unknown',
        driverName: d?.name || '—',
      };
    });

    arr.sort((a, b) => {
      const dir = truckSortDir === 'asc' ? 1 : -1;
      if (truckSort === 'fuel') return (a.fuel - b.fuel) * dir;
      if (truckSort === 'maintenance') return (a.maintenance - b.maintenance) * dir;
      return (a.total - b.total) * dir;
    });
    return arr;
  }, [filteredExpenses, trucks, drivers, truckSort, truckSortDir]);

  const truckTableTotalPages = Math.max(1, Math.ceil(truckTableData.length / 10));
  const truckTablePaged = truckTableData.slice((truckPage - 1) * 10, truckPage * 10);

  const truckTableTotals = useMemo(() => {
    return truckTableData.reduce(
      (acc, r) => ({
        total: acc.total + r.total, fuel: acc.fuel + r.fuel, maintenance: acc.maintenance + r.maintenance,
        repairs: acc.repairs + r.repairs, tires: acc.tires + r.tires, other: acc.other + r.other,
      }),
      { total: 0, fuel: 0, maintenance: 0, repairs: 0, tires: 0, other: 0 }
    );
  }, [truckTableData]);

  // CPM Widget
  const cpmData = useMemo(() => {
    const withOdometer = filteredExpenses.filter(e => e.odometer_reading && e.odometer_reading > 0);
    if (withOdometer.length < filteredExpenses.length * 0.5 || withOdometer.length < 2) return null;
    const readings = withOdometer.map(e => e.odometer_reading!).sort((a, b) => a - b);
    const totalMiles = readings[readings.length - 1] - readings[0];
    if (totalMiles <= 0) return null;
    const totalExp = withOdometer.reduce((s, e) => s + e.total_amount, 0);
    return { cpm: totalExp / totalMiles, totalMiles, totalExp };
  }, [filteredExpenses]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleTruckSort = (col: typeof truckSort) => {
    if (truckSort === col) setTruckSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTruckSort(col); setTruckSortDir('desc'); }
  };

  // --- Export helpers ---
  const exportToCSV = () => {
    const headers = ['Date', 'Truck', 'Driver', 'Type', 'Description', 'Amount', 'Tax', 'Total', 'Vendor', 'Payment Method', 'Source'];
    const rows = filteredExpenses.map(e => {
      const t = trucks.find(tr => tr.id === e.truck_id);
      return [
        e.expense_date, t ? `#${t.unit_number}` : '', e.driver_name || '',
        EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type, e.description,
        e.amount.toFixed(2), (e.tax_amount || 0).toFixed(2), e.total_amount.toFixed(2),
        e.vendor || '', e.payment_method, e.source,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(csv, 'text/csv', `Expenses_Export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportToExcel = () => {
    const headers = ['Date', 'Truck', 'Driver', 'Type', 'Description', 'Amount', 'Tax', 'Total', 'Vendor', 'Payment Method'];
    const rows = filteredExpenses.map(e => {
      const t = trucks.find(tr => tr.id === e.truck_id);
      return [
        e.expense_date, t ? `#${t.unit_number}` : '', e.driver_name || '',
        EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type, e.description,
        e.amount.toFixed(2), (e.tax_amount || 0).toFixed(2), e.total_amount.toFixed(2),
        e.vendor || '', e.payment_method,
      ];
    });
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    downloadFile(tsv, 'application/vnd.ms-excel', `Expenses_${new Date().toISOString().split('T')[0]}.xls`);
  };

  const exportFuelReport = () => {
    const fuelOnly = filteredExpenses.filter(e => e.expense_type === 'fuel');
    const headers = ['Date', 'Truck', 'Driver', 'Amount', 'Total', 'Vendor', 'Location', 'Odometer'];
    const rows = fuelOnly.map(e => {
      const t = trucks.find(tr => tr.id === e.truck_id);
      return [
        e.expense_date, t ? `#${t.unit_number}` : '', e.driver_name || '',
        e.amount.toFixed(2), e.total_amount.toFixed(2),
        e.vendor || '', e.location || '', e.odometer_reading || '',
      ];
    });
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    downloadFile(tsv, 'application/vnd.ms-excel', `FuelReport_${new Date().toISOString().split('T')[0]}.xls`);
  };

  const exportTruckBreakdown = () => {
    const headers = ['Truck', 'Driver', 'Fuel', 'Maintenance', 'Repairs', 'Tires', 'Other', 'Total'];
    const rows = truckTableData.map(r => [
      r.truck, r.driverName, r.fuel.toFixed(2),
      r.maintenance.toFixed(2), r.repairs.toFixed(2), r.tires.toFixed(2),
      r.other.toFixed(2), r.total.toFixed(2),
    ]);
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    downloadFile(tsv, 'application/vnd.ms-excel', `TruckExpenseBreakdown_${new Date().toISOString().split('T')[0]}.xls`);
  };

  const downloadFile = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base">Expense Summary</CardTitle>
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-3">
                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={exportToExcel} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Export Current View to Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                      <FileDown className="h-4 w-4 text-blue-600" />
                      Export All Data to CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportTruckBreakdown} className="gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                      Truck Breakdown Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportFuelReport} className="gap-2">
                      <Fuel className="h-4 w-4 text-amber-600" />
                      Fuel Consumption Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Company Driver Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Company Drivers Only</span>
                  <Switch checked={companyDriverOnly} onCheckedChange={setCompanyDriverOnly} />
                </div>
              </div>
            </div>
            {/* Filter state badge */}
            <Badge variant="outline" className={`self-start text-xs ${companyDriverOnly ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'}`}>
              {companyDriverOnly
                ? `Filtered: Company Drivers Only (${filteredTruckCount} trucks)`
                : `Showing: All Trucks (${filteredTruckCount} trucks)`
              }
            </Badge>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/10"><DollarSign className="h-5 w-5 text-blue-600" /></div>
                    <span className="text-xs text-muted-foreground font-medium">Total Expenses</span>
                  </div>
                  <p className="text-2xl font-bold">${fmt(totalExpenses)}</p>
                  <p className="text-xs text-muted-foreground mt-1">For selected period • {filteredExpenses.length} transactions</p>
                </CardContent>
              </Card>

              {/* Fuel */}
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/10"><Fuel className="h-5 w-5 text-amber-600" /></div>
                    <span className="text-xs text-muted-foreground font-medium">Fuel Expenses</span>
                  </div>
                  <p className="text-2xl font-bold">${fmt(fuelTotal)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-xs">{fuelPct}% of total</Badge>
                    <span className="text-xs text-muted-foreground">Avg: ${fmt(avgFuelTx)}/tx</span>
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10"><Wrench className="h-5 w-5 text-green-600" /></div>
                    <span className="text-xs text-muted-foreground font-medium">Maintenance & Repairs</span>
                  </div>
                  <p className="text-2xl font-bold">${fmt(maintTotal)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-xs">{maintPct}% of total</Badge>
                    <span className="text-xs text-muted-foreground">{maintRepairExpenses.length} services</span>
                  </div>
                </CardContent>
              </Card>

              {/* Other */}
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/10"><Receipt className="h-5 w-5 text-purple-600" /></div>
                    <span className="text-xs text-muted-foreground font-medium">Other Expenses</span>
                  </div>
                  <p className="text-2xl font-bold">${fmt(otherTotal)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-xs">{otherPct}% of total</Badge>
                    <span className="text-xs text-muted-foreground">Tires, Tolls, Permits...</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Donut Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Expenses by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {donutData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {donutData.map((_, i) => (
                              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                          <ReTooltip formatter={(val: number) => `$${fmt(val)}`} />
                          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-sm font-bold">
                            ${totalExpenses >= 1000 ? `${(totalExpenses / 1000).toFixed(1)}k` : fmt(totalExpenses)}
                          </text>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {donutData.slice(0, 5).map((d, i) => (
                          <div key={d.name} className="flex items-center gap-1 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            <span className="text-muted-foreground">{d.name} ({d.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart - Top Trucks */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top Trucks by Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  {truckBarData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={truckBarData} layout="vertical" margin={{ left: 10, right: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} className="fill-muted-foreground" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} className="fill-muted-foreground" />
                        <ReTooltip formatter={(val: number) => `$${fmt(val)}`} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {truckBarData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                          <LabelList dataKey="total" position="right" fill="#1e3a5f" fontSize={12} fontWeight={700} formatter={(v: number) => `$${fmt(v)}`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Truck Breakdown Table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Expense Breakdown by Truck</CardTitle>
                    {companyDriverOnly && <p className="text-xs text-muted-foreground">(Company Drivers Only)</p>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2.5 text-left font-medium text-muted-foreground">Truck</th>
                        <th className="p-2.5 text-left font-medium text-muted-foreground">Driver</th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleTruckSort('fuel')}>
                          Fuel {truckSort === 'fuel' && (truckSortDir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell"
                          onClick={() => handleTruckSort('maintenance')}>
                          Maint {truckSort === 'maintenance' && (truckSortDir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground hidden md:table-cell">Repairs</th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground hidden lg:table-cell">Tires</th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground hidden lg:table-cell">Other</th>
                        <th className="p-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-primary/5 border-l-2 border-primary"
                          onClick={() => handleTruckSort('total')}>
                          Total {truckSort === 'total' && (truckSortDir === 'desc' ? '↓' : '↑')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {truckTablePaged.length === 0 ? (
                        <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No truck data</td></tr>
                      ) : truckTablePaged.map(row => (
                        <tr key={row.truckId} className="border-b hover:bg-muted/30">
                          <td className="p-2.5 font-medium">{row.truck}</td>
                          <td className="p-2.5 text-muted-foreground">{row.driverName}</td>
                          <td className="p-2.5 text-right">${fmt(row.fuel)}</td>
                          <td className="p-2.5 text-right hidden md:table-cell">${fmt(row.maintenance)}</td>
                          <td className="p-2.5 text-right hidden md:table-cell">${fmt(row.repairs)}</td>
                          <td className="p-2.5 text-right hidden lg:table-cell">${fmt(row.tires)}</td>
                          <td className="p-2.5 text-right hidden lg:table-cell">${fmt(row.other)}</td>
                          <td className="p-2.5 text-right font-bold text-primary bg-primary/5 border-l-2 border-primary">${fmt(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {truckTableData.length > 0 && (
                      <tfoot>
                        <tr className="bg-muted/50 font-semibold">
                          <td className="p-2.5" colSpan={2}>
                            Total ({truckTableData.length} trucks)
                          </td>
                          <td className="p-2.5 text-right">${fmt(truckTableTotals.fuel)}</td>
                          <td className="p-2.5 text-right hidden md:table-cell">${fmt(truckTableTotals.maintenance)}</td>
                          <td className="p-2.5 text-right hidden md:table-cell">${fmt(truckTableTotals.repairs)}</td>
                          <td className="p-2.5 text-right hidden lg:table-cell">${fmt(truckTableTotals.tires)}</td>
                          <td className="p-2.5 text-right hidden lg:table-cell">${fmt(truckTableTotals.other)}</td>
                          <td className="p-2.5 text-right font-bold text-primary bg-primary/5 border-l-2 border-primary">${fmt(truckTableTotals.total)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {truckTableTotalPages > 1 && (
                  <div className="flex items-center justify-end gap-2 p-3 border-t">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={truckPage <= 1}
                      onClick={() => setTruckPage(p => p - 1)}>Prev</Button>
                    <span className="text-xs">{truckPage}/{truckTableTotalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={truckPage >= truckTableTotalPages}
                      onClick={() => setTruckPage(p => p + 1)}>Next</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CPM Widget */}
            {cpmData && (
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-semibold">Cost Per Mile Analysis</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Average CPM</p>
                      <p className="text-xl font-bold">${cpmData.cpm.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Miles</p>
                      <p className="text-xl font-bold">{cpmData.totalMiles.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="text-xl font-bold">${fmt(cpmData.totalExp)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

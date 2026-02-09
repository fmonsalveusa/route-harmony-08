import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { usePayments } from '@/hooks/usePayments';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useExpenses } from '@/hooks/useExpenses';
import { Package, Truck, DollarSign, AlertTriangle, TrendingUp, Users, Headphones, Fuel, Receipt, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { RatesByDriverChart } from '@/components/dashboard/RatesByDriverChart';
import { WeeklyRatesChart } from '@/components/dashboard/WeeklyRatesChart';
import { DispatcherCommissionsChart } from '@/components/dashboard/DispatcherCommissionsChart';
import { MarketAnalysisCard } from '@/components/dashboard/MarketAnalysisCard';
import { EXPENSE_TYPE_LABELS } from '@/components/expenses/expenseConstants';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { payments } = usePayments();
  const { dispatchers } = useDispatchers();
  const { expenses } = useExpenses();
  const navigate = useNavigate();

  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [week, setWeek] = useState('all');

  const totalRevenue = loads.filter(l => l.status !== 'cancelled').reduce((s, l) => s + l.total_rate, 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const activeLoads = loads.filter(l => ['in_transit', 'pending'].includes(l.status)).length;
  const availableTrucks = trucks.filter(t => t.status === 'available').length;

  // Expense data for widgets
  const now = new Date();
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyExpenseTotal = thisMonthExpenses.reduce((s, e) => s + e.total_amount, 0);
  const recentExpenses = expenses.slice(0, 5);

  // High expense alerts (> $400 single expense)
  const highExpenses = thisMonthExpenses.filter(e => e.total_amount > 400).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-description">Resumen general del sistema de transporte</p>
        </div>
        <DashboardFilters year={year} month={month} week={week} onYearChange={setYear} onMonthChange={setMonth} onWeekChange={setWeek} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cargas Activas" value={activeLoads} icon={Package} trend={{ value: '+12%', positive: true }} />
        <StatCard title="Camiones Disponibles" value={`${availableTrucks}/${trucks.length}`} icon={Truck} iconClassName="bg-success/10 text-success" />
        <StatCard title="Ingresos del Mes" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} trend={{ value: '+8%', positive: true }} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Pagos Pendientes" value={`$${pendingPayments.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" subtitle={`${payments.filter(p => p.status === 'pending').length} pagos`} />
      </div>

      {/* Charts Row 1: Rates by Driver + Weekly Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RatesByDriverChart loads={loads} drivers={drivers} year={year} month={month} week={week} />
        <WeeklyRatesChart loads={loads} />
      </div>

      {/* Charts Row 2: Dispatcher Commissions + Market Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DispatcherCommissionsChart loads={loads} dispatchers={dispatchers} drivers={drivers} year={year} month={month} week={week} />
        <MarketAnalysisCard loads={loads} trucks={trucks} />
      </div>

      {/* Recent loads table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cargas Recientes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ruta</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Tarifa</th>
              </tr></thead>
              <tbody>
                {loads.slice(0, 5).map(load => (
                  <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{load.reference_number}</td>
                    <td className="p-3 text-muted-foreground">{load.origin} → {load.destination}</td>
                    <td className="p-3"><StatusBadge status={load.status} /></td>
                    <td className="p-3 text-right font-semibold">${load.total_rate.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Expense Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Expenses Widget */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Expenses</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                This Month: ${monthlyExpenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Date</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Truck</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Type</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-xs">No expenses recorded</td></tr>
                  ) : recentExpenses.map(e => {
                    const t = trucks.find(tr => tr.id === e.truck_id);
                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2.5 text-xs">{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-US')}</td>
                        <td className="p-2.5 text-xs">{t ? `#${t.unit_number}` : '—'}</td>
                        <td className="p-2.5 text-xs">{EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}</td>
                        <td className="p-2.5 text-right text-xs font-semibold">${e.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t">
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => navigate('/expenses')}>
                View All Expenses <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Expense Alerts Widget */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Expense Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {highExpenses.length === 0 && thisMonthExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No alerts this month</p>
            ) : (
              <>
                {highExpenses.map(e => {
                  const t = trucks.find(tr => tr.id === e.truck_id);
                  return (
                    <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">
                          High expense: {t ? `Truck #${t.unit_number}` : 'Unknown'} — ${e.total_amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}: {e.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {thisMonthExpenses.length > 0 && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <Fuel className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">Monthly fuel spending</p>
                      <p className="text-xs text-muted-foreground">
                        ${thisMonthExpenses.filter(e => e.expense_type === 'fuel').reduce((s, e) => s + e.total_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} spent on fuel this month
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const DispatcherDashboard = () => {
  const { profile } = useAuth();
  const { loads } = useLoads();
  const { drivers } = useDrivers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Mi Dashboard</h1>
        <p className="page-description">Resumen de tus cargas, drivers y comisiones</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mis Cargas Activas" value={loads.filter(l => ['in_transit', 'pending'].includes(l.status)).length} icon={Package} />
        <StatCard title="Mis Drivers" value={drivers.length} icon={Users} iconClassName="bg-info/10 text-info" />
        <StatCard title="Comisiones del Mes" value="$0" icon={DollarSign} iconClassName="bg-success/10 text-success" />
        <StatCard title="Comisiones Pendientes" value="$0" icon={TrendingUp} iconClassName="bg-warning/10 text-warning" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Mis Cargas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ruta</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Tarifa</th>
              </tr></thead>
              <tbody>
                {loads.slice(0, 10).map(load => {
                  const driver = drivers.find(d => d.id === load.driver_id);
                  return (
                    <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{load.reference_number}</td>
                      <td className="p-3 text-muted-foreground">{load.origin} → {load.destination}</td>
                      <td className="p-3">{driver?.name || '—'}</td>
                      <td className="p-3"><StatusBadge status={load.status} /></td>
                      <td className="p-3 text-right font-semibold">${load.total_rate.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Dashboard = () => {
  const { role } = useAuth();
  if (role === 'dispatcher') return <DispatcherDashboard />;
  return <AdminDashboard />;
};

export default Dashboard;

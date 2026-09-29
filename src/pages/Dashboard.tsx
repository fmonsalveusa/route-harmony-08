import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDispatcherDriverIds } from '@/hooks/useDispatcherDriverIds';
import { StatTiles } from '@/components/StatTiles';
import { StatusBadge } from '@/components/StatusBadge';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { usePayments } from '@/hooks/usePayments';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useExpenses } from '@/hooks/useExpenses';
import { Package, Truck, DollarSign, AlertTriangle, TrendingUp, Users, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { RatesByDriverChart } from '@/components/dashboard/RatesByDriverChart';
import { ProfitByDriverChart } from '@/components/dashboard/ProfitByDriverChart';
import { WeeklyRatesChart } from '@/components/dashboard/WeeklyRatesChart';
import { DispatcherCommissionsChart } from '@/components/dashboard/DispatcherCommissionsChart';
import { MarketAnalysisCard } from '@/components/dashboard/MarketAnalysisCard';
import { RevenueBySegmentChart } from '@/components/dashboard/RevenueBySegmentChart';


import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { role, isMasterAdmin } = useAuth();
  const isAdmin = role === 'admin' || isMasterAdmin;
  const { trucks } = useTrucks();
  const { payments } = usePayments();
  const { dispatchers } = useDispatchers();
  const { expenses } = useExpenses();
  const navigate = useNavigate();

  // Calculate current ISO week number
  const getCurrentWeek = () => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diff = now.getTime() - mondayOfWeek1.getTime();
    const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    return String(Math.min(weekNum, 52));
  };

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('all');
  const [week, setWeek] = useState(getCurrentWeek());
  const [dispatcherFilter, setDispatcherFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');

  const filteredLoads = loads.filter(l => {
    if (dispatcherFilter !== 'all' && l.dispatcher_id !== dispatcherFilter) return false;
    if (driverFilter !== 'all' && l.driver_id !== driverFilter) return false;

    if (!l.pickup_date) return false;
    const d = new Date(l.pickup_date + 'T00:00:00');

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
  });

  const totalRevenue = filteredLoads.filter(l => l.status !== 'cancelled').reduce((s, l) => s + l.total_rate, 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const activeLoads = loads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status)).length;
  const trucksWithActiveLoad = new Set(
    loads.filter(l => ['pending', 'planned', 'dispatched', 'in_transit'].includes(l.status) && l.truck_id).map(l => l.truck_id)
  );
  const availableTrucks = trucks.filter(t => !trucksWithActiveLoad.has(t.id)).length;

  const now = new Date();

  // Month-to-date revenue (current month, all loads regardless of filters)
  const monthToDateRevenue = loads.filter(l => {
    if (l.status === 'cancelled') return false;
    if (!l.pickup_date) return false;
    const d = new Date(l.pickup_date + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, l) => s + l.total_rate, 0);
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyExpenseTotal = thisMonthExpenses.reduce((s, e) => s + e.total_amount, 0);
  const recentExpenses = expenses.slice(0, 5);
  const highExpenses = thisMonthExpenses.filter(e => e.total_amount > 400).slice(0, 3);

  // Período que cubre la tarjeta de Revenue, según los filtros
  const periodLabel = week !== 'all' ? `Week ${week}` : month !== 'all' ? `Month ${month}/${year}` : year !== 'all' ? `Year ${year}` : 'All time';

  const dispatcherOptions = dispatchers.map(d => ({ id: d.id, name: d.name }));
  const driverOptions = drivers.map(d => ({ id: d.id, name: d.name }));

  // Driver IDs filtrados por service type — para WeeklyRatesChart
  const filteredDriverIds = serviceTypeFilter === 'all'
    ? undefined
    : new Set(drivers.filter(d => d.service_type === serviceTypeFilter).map(d => d.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">General overview of the transportation system</p>
      </div>
      <DashboardFilters
        year={year} month={month} week={week}
        dispatcher={dispatcherFilter} driver={driverFilter}
        onYearChange={setYear} onMonthChange={setMonth} onWeekChange={setWeek}
        onDispatcherChange={setDispatcherFilter} onDriverChange={setDriverFilter}
        dispatchers={dispatcherOptions} drivers={driverOptions}
      />

      {/* Los "+12%" y "+8%" que había aquí eran fijos, no salían de ningún cálculo: se quitaron */}
      <StatTiles tiles={[
        { label: 'Active Loads', value: activeLoads, icon: Package, tint: 'bg-sky-100 text-sky-700' },
        { label: 'Available Trucks', value: `${availableTrucks}/${trucks.length}`, icon: Truck, tint: 'bg-emerald-100 text-emerald-700' },
        { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, hint: periodLabel, icon: DollarSign, tint: 'bg-amber-100 text-amber-700' },
        { label: 'Month-to-date', value: `$${monthToDateRevenue.toLocaleString()}`, icon: TrendingUp, tint: 'bg-blue-100 text-blue-700' },
        { label: 'Pending Payments', value: `$${pendingPayments.toLocaleString()}`, hint: `${payments.filter(p => p.status === 'pending').length} payments`, icon: AlertTriangle, tint: 'bg-red-100 text-red-700' },
      ]} />

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Driver Type:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'company_driver', label: 'Company Drivers' },
            { value: 'owner_operator', label: 'Owner Operators' },
            { value: 'dispatch_service', label: 'Dispatch Service' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setServiceTypeFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                serviceTypeFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border bg-card shadow-sm'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RatesByDriverChart loads={filteredLoads} drivers={drivers} year={year} month={month} week={week} serviceType={serviceTypeFilter} />
          <WeeklyRatesChart driverIds={filteredDriverIds} />
        </div>
        {isAdmin && (
          <div className="pt-2">
            <ProfitByDriverChart
              loads={filteredLoads}
              drivers={drivers}
              trucks={trucks}
              dispatchers={dispatchers}
              serviceType={serviceTypeFilter}
            />
          </div>
        )}
      </div>

      {isAdmin && (
        <RevenueBySegmentChart
          loads={loads}
          drivers={drivers}
          dispatchers={dispatchers}
          expenses={expenses}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DispatcherCommissionsChart loads={filteredLoads} dispatchers={dispatchers} year={year} month={month} week={week} />
        <MarketAnalysisCard loads={filteredLoads} trucks={trucks} />
      </div>

    </div>
  );
};

const DispatcherDashboard = () => {
  const { loads: allLoads, loading: loadsLoading } = useLoads();
  const { drivers: allDrivers, loading: driversLoading } = useDrivers();
  const { trucks } = useTrucks();
  const { payments } = usePayments();
  const { dispatchers } = useDispatchers();
  const { expenses } = useExpenses();
  const navigate = useNavigate();

  // Resolve dispatcher scope via server-side SQL function (reliable, no JS email matching)
  const { loading: scopeLoading, driverIds: dispatcherDriverIds } = useDispatcherDriverIds();

  const drivers = useMemo(
    () => dispatcherDriverIds ? allDrivers.filter((d) => dispatcherDriverIds.has(d.id)) : allDrivers,
    [allDrivers, dispatcherDriverIds]
  );
  const loads = useMemo(
    () => dispatcherDriverIds ? allLoads.filter((l) => l.driver_id && dispatcherDriverIds.has(l.driver_id)) : allLoads,
    [allLoads, dispatcherDriverIds]
  );

  const getCurrentWeek = () => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diff = now.getTime() - mondayOfWeek1.getTime();
    const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    return String(Math.min(weekNum, 52));
  };

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('all');
  const [week, setWeek] = useState(getCurrentWeek());
  const [driverFilter, setDriverFilter] = useState('all');

  if (loadsLoading || driversLoading || scopeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredLoads = loads.filter(l => {
    if (driverFilter !== 'all' && l.driver_id !== driverFilter) return false;
    if (!l.pickup_date) return false;
    const d = new Date(l.pickup_date + 'T00:00:00');
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
  });

  const totalRevenue = filteredLoads.filter(l => l.status !== 'cancelled').reduce((s, l) => s + l.total_rate, 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const activeLoads = loads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status)).length;
  const deliveredLoads = filteredLoads.filter(l => l.status === 'delivered').length;

  const now = new Date();
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyExpenseTotal = thisMonthExpenses.reduce((s, e) => s + e.total_amount, 0);
  const recentExpenses = expenses.slice(0, 5);
  const highExpenses = thisMonthExpenses.filter(e => e.total_amount > 400).slice(0, 3);

  const driverOptions = drivers.map(d => ({ id: d.id, name: d.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">My Dashboard</h1>
        <p className="page-description">Overview of your loads, drivers, and commissions</p>
      </div>

      <DashboardFilters
        year={year} month={month} week={week}
        dispatcher="all" driver={driverFilter}
        onYearChange={setYear} onMonthChange={setMonth} onWeekChange={setWeek}
        onDispatcherChange={() => {}} onDriverChange={setDriverFilter}
        dispatchers={[]} drivers={driverOptions}
        hideDispatcherFilter
      />

      <StatTiles tiles={[
        { label: 'Active Loads', value: activeLoads, icon: Package, tint: 'bg-sky-100 text-sky-700' },
        { label: 'My Drivers', value: drivers.length, icon: Users, tint: 'bg-blue-100 text-blue-700' },
        { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, tint: 'bg-emerald-100 text-emerald-700' },
        { label: 'Delivered', value: deliveredLoads, icon: TrendingUp, tint: 'bg-amber-100 text-amber-700' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RatesByDriverChart loads={filteredLoads} drivers={drivers} year={year} month={month} week={week} />
        <WeeklyRatesChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DispatcherCommissionsChart loads={filteredLoads} dispatchers={dispatchers} year={year} month={month} week={week} />
        <MarketAnalysisCard loads={filteredLoads} trucks={trucks} />
      </div>

      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader><CardTitle className="text-base">My Loads</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Route</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
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
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (role === 'dispatcher') return <DispatcherDashboard />;
  return <AdminDashboard />;
};

export default Dashboard;

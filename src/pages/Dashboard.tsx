import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { usePayments } from '@/hooks/usePayments';
import { Package, Truck, DollarSign, AlertTriangle, TrendingUp, Users, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { RatesByDriverChart } from '@/components/dashboard/RatesByDriverChart';
import { WeeklyRatesChart } from '@/components/dashboard/WeeklyRatesChart';
import { DispatcherCommissionsChart } from '@/components/dashboard/DispatcherCommissionsChart';
import { MarketAnalysisCard } from '@/components/dashboard/MarketAnalysisCard';

const AdminDashboard = () => {
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { payments } = usePayments();

  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [week, setWeek] = useState('all');

  const totalRevenue = loads.filter(l => l.status !== 'cancelled').reduce((s, l) => s + l.total_rate, 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const activeLoads = loads.filter(l => ['in_transit', 'pending'].includes(l.status)).length;
  const availableTrucks = trucks.filter(t => t.status === 'available').length;

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
        <DispatcherCommissionsChart payments={payments} year={year} month={month} week={week} />
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

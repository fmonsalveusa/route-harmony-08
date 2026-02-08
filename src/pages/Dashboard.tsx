import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { mockLoads, mockDrivers, mockTrucks, mockPayments, mockDispatchers } from '@/data/mockData';
import { Package, Truck, DollarSign, Users, AlertTriangle, TrendingUp, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Helper to get dispatcherId from profile metadata (will be refined later)
const getDispatcherId = (profile: any) => profile?.dispatcher_id || 'd1';

const revenueData = [
  { month: 'Sep', revenue: 18500 },
  { month: 'Oct', revenue: 22000 },
  { month: 'Nov', revenue: 19800 },
  { month: 'Dec', revenue: 25600 },
  { month: 'Ene', revenue: 21400 },
];

const loadStatusData = [
  { name: 'Pendiente', value: 2, color: 'hsl(38, 92%, 50%)' },
  { name: 'En Tránsito', value: 2, color: 'hsl(205, 85%, 50%)' },
  { name: 'Entregada', value: 2, color: 'hsl(152, 60%, 40%)' },
  { name: 'Pagada', value: 1, color: 'hsl(215, 70%, 35%)' },
  { name: 'Cancelada', value: 1, color: 'hsl(0, 72%, 51%)' },
];

const AdminDashboard = () => {
  const totalRevenue = mockLoads.filter(l => l.status !== 'cancelled').reduce((s, l) => s + l.totalRate, 0);
  const pendingPayments = mockPayments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const activeLoads = mockLoads.filter(l => ['in_transit', 'pending'].includes(l.status)).length;
  const availableTrucks = mockTrucks.filter(t => t.status === 'available').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-description">Resumen general del sistema de transporte</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cargas Activas" value={activeLoads} icon={Package} trend={{ value: '+12%', positive: true }} />
        <StatCard title="Camiones Disponibles" value={`${availableTrucks}/${mockTrucks.length}`} icon={Truck} iconClassName="bg-success/10 text-success" />
        <StatCard title="Ingresos del Mes" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} trend={{ value: '+8%', positive: true }} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Pagos Pendientes" value={`$${pendingPayments.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" subtitle={`${mockPayments.filter(p => p.status === 'pending').length} pagos`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Ingresos Mensuales</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Ingresos']} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Estado de Cargas</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={loadStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {loadStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-6 pb-4 grid grid-cols-2 gap-2">
            {loadStatusData.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  {mockLoads.slice(0, 5).map(load => (
                    <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{load.referenceNumber}</td>
                      <td className="p-3 text-muted-foreground">{load.origin} → {load.destination}</td>
                      <td className="p-3"><StatusBadge status={load.status} /></td>
                      <td className="p-3 text-right font-semibold">${load.totalRate.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Rendimiento Dispatchers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mockDispatchers.filter(d => d.status === 'active').map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-info/20 flex items-center justify-center">
                    <Headphones className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.driversCount} drivers · {d.loadsThisMonth} cargas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${d.commissionsThisMonth.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">comisiones</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const DispatcherDashboard = () => {
  const { profile } = useAuth();
  const dispatcherId = getDispatcherId(profile);
  const myLoads = mockLoads.filter(l => l.dispatcherId === dispatcherId);
  const myDrivers = mockDrivers.filter(d => d.dispatcherId === dispatcherId);
  const myDispatcher = mockDispatchers.find(d => d.id === dispatcherId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Mi Dashboard</h1>
        <p className="page-description">Resumen de tus cargas, drivers y comisiones</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mis Cargas Activas" value={myLoads.filter(l => ['in_transit', 'pending'].includes(l.status)).length} icon={Package} />
        <StatCard title="Mis Drivers" value={myDrivers.length} icon={Users} iconClassName="bg-info/10 text-info" />
        <StatCard title="Comisiones del Mes" value={`$${myDispatcher?.commissionsThisMonth.toLocaleString() || 0}`} icon={DollarSign} iconClassName="bg-success/10 text-success" />
        <StatCard title="Comisiones Pendientes" value={`$${myDispatcher?.commissionsPending.toLocaleString() || 0}`} icon={TrendingUp} iconClassName="bg-warning/10 text-warning" />
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
                {myLoads.map(load => {
                  const driver = mockDrivers.find(d => d.id === load.driverId);
                  return (
                    <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{load.referenceNumber}</td>
                      <td className="p-3 text-muted-foreground">{load.origin} → {load.destination}</td>
                      <td className="p-3">{driver?.name || '—'}</td>
                      <td className="p-3"><StatusBadge status={load.status} /></td>
                      <td className="p-3 text-right font-semibold">${load.totalRate.toLocaleString()}</td>
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

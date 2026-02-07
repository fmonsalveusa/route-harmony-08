import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, Package, Percent } from 'lucide-react';

const monthlyData = [
  { month: 'Sep', ingresos: 42000, gastos: 28000, utilidad: 14000 },
  { month: 'Oct', ingresos: 48000, gastos: 31000, utilidad: 17000 },
  { month: 'Nov', ingresos: 45000, gastos: 29500, utilidad: 15500 },
  { month: 'Dec', ingresos: 52000, gastos: 33000, utilidad: 19000 },
  { month: 'Ene', ingresos: 47500, gastos: 30000, utilidad: 17500 },
];

const Reports = () => {
  const { user } = useAuth();
  const isDispatcher = user?.role === 'dispatcher';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Reportes</h1>
        <p className="page-description">{isDispatcher ? 'Tu rendimiento y métricas' : 'Análisis financiero y operacional'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ingresos Totales" value="$47,500" icon={DollarSign} trend={{ value: '+8.2%', positive: true }} />
        <StatCard title="Utilidad Neta" value="$17,500" icon={TrendingUp} trend={{ value: '+5.1%', positive: true }} iconClassName="bg-success/10 text-success" />
        <StatCard title="Cargas Completadas" value="28" icon={Package} iconClassName="bg-info/10 text-info" />
        <StatCard title="Margen Promedio" value="36.8%" icon={Percent} iconClassName="bg-warning/10 text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos vs Gastos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gastos" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Gastos" opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tendencia de Utilidad</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="utilidad" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 4 }} name="Utilidad" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;

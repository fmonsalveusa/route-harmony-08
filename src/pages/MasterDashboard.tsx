import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Package, DollarSign, Truck, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MasterDashboard = () => {
  const [stats, setStats] = useState({
    totalTenants: 0, activeTenants: 0, totalUsers: 0, totalTrucks: 0,
    totalLoads: 0, totalRevenue: 0, mrrTotal: 0, pendingPayments: 0,
  });
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [tenantsRes, profilesRes, trucksRes, loadsRes, subsRes] = await Promise.all([
        supabase.from('tenants').select('id, name, is_active, created_at'),
        supabase.from('profiles').select('id, tenant_id').not('is_master_admin', 'eq', true),
        supabase.from('trucks').select('id'),
        supabase.from('loads').select('id, total_rate'),
        supabase.from('subscriptions').select('tenant_id, plan, status, price_monthly, next_payment_date'),
      ]);

      const allTenants = tenantsRes.data || [];
      const activeTenants = allTenants.filter(t => t.is_active);
      const totalUsers = (profilesRes.data || []).length;
      const totalTrucks = (trucksRes.data || []).length;
      const loads = loadsRes.data || [];
      const totalRevenue = loads.reduce((s, l) => s + Number(l.total_rate || 0), 0);
      const subs = subsRes.data || [];
      const mrrTotal = subs.filter(s => s.status === 'active').reduce((s, sub) => s + Number(sub.price_monthly || 0), 0);

      setStats({
        totalTenants: allTenants.length,
        activeTenants: activeTenants.length,
        totalUsers,
        totalTrucks,
        totalLoads: loads.length,
        totalRevenue,
        mrrTotal,
        pendingPayments: subs.filter(s => s.status === 'pending_payment').length,
      });

      const subsMap = Object.fromEntries(subs.map(s => [s.tenant_id, s]));
      setTenants(allTenants.map(t => ({ ...t, subscription: subsMap[t.id] })));
      setLoading(false);
    };

    fetchStats();
  }, []);

  const planBadge = (plan: string) => {
    const styles: Record<string, string> = {
      basic: 'bg-green-100 text-green-700',
      intermediate: 'bg-[#266aad]/20 text-[#266aad]',
      pro: 'bg-amber-100 text-amber-700',
    };
    return <Badge className={styles[plan] || 'bg-muted text-muted-foreground'}>{plan?.toUpperCase()}</Badge>;
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      pending_payment: 'bg-amber-100 text-amber-700',
      suspended: 'bg-red-100 text-red-700',
      cancelled: 'bg-muted text-muted-foreground',
    };
    const labels: Record<string, string> = {
      active: 'Active', pending_payment: 'Pending', suspended: 'Suspended', cancelled: 'Cancelled',
    };
    return <Badge className={styles[status] || 'bg-muted text-muted-foreground'}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Master Admin Dashboard</h1>
        <p className="page-description">Global overview of the Dispatch Up TMS platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Companies" value={`${stats.activeTenants}/${stats.totalTenants}`} icon={Building2} iconClassName="bg-purple-100 text-purple-600" />
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} iconClassName="bg-info/10 text-info" />
        <StatCard title="MRR Revenue" value={`$${stats.mrrTotal.toLocaleString()}`} icon={DollarSign} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Loads" value={stats.totalLoads} icon={Package} iconClassName="bg-warning/10 text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatCard title="Global Trucks" value={stats.totalTrucks} icon={Truck} iconClassName="bg-info/10 text-info" />
        <StatCard title="Load Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} iconClassName="bg-success/10 text-success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Companies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">$/mo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No companies registered yet.</td></tr>
                )}
                {tenants.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3">{t.subscription ? planBadge(t.subscription.plan) : '—'}</td>
                    <td className="p-3">{t.subscription ? statusBadge(t.subscription.status) : (t.is_active ? statusBadge('active') : statusBadge('suspended'))}</td>
                    <td className="p-3 text-right font-semibold">${Number(t.subscription?.price_monthly || 0).toLocaleString()}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
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

export default MasterDashboard;

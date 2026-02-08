import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Package, Truck, DollarSign, TrendingUp } from 'lucide-react';

const MasterStats = () => {
  const [data, setData] = useState<any>({ tenants: 0, users: 0, loads: 0, trucks: 0, revenue: 0, mrr: 0 });

  useEffect(() => {
    const fetch = async () => {
      const [t, u, l, tr, s] = await Promise.all([
        supabase.from('tenants').select('id'),
        supabase.from('profiles').select('id').not('is_master_admin', 'eq', true),
        supabase.from('loads').select('id, total_rate'),
        supabase.from('trucks').select('id'),
        supabase.from('subscriptions').select('price_monthly, status'),
      ]);
      setData({
        tenants: (t.data || []).length,
        users: (u.data || []).length,
        loads: (l.data || []).length,
        trucks: (tr.data || []).length,
        revenue: (l.data || []).reduce((sum: number, ld: any) => sum + Number(ld.total_rate || 0), 0),
        mrr: (s.data || []).filter((sub: any) => sub.status === 'active').reduce((sum: number, sub: any) => sum + Number(sub.price_monthly || 0), 0),
      });
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Global Statistics</h1>
        <p className="page-description">Platform-wide usage metrics</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Total Companies" value={data.tenants} icon={Building2} iconClassName="bg-purple-100 text-purple-600" />
            <StatCard title="Total Users" value={data.users} icon={Users} iconClassName="bg-info/10 text-info" />
            <StatCard title="Total Loads" value={data.loads} icon={Package} iconClassName="bg-warning/10 text-warning" />
            <StatCard title="Total Trucks" value={data.trucks} icon={Truck} iconClassName="bg-success/10 text-success" />
            <StatCard title="Load Revenue" value={`$${data.revenue.toLocaleString()}`} icon={DollarSign} iconClassName="bg-success/10 text-success" />
            <StatCard title="Subscription MRR" value={`$${data.mrr.toLocaleString()}`} icon={TrendingUp} iconClassName="bg-purple-100 text-purple-600" />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Loads/Company</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.tenants ? (data.loads / data.tenants).toFixed(1) : 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Users/Company</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.tenants ? (data.users / data.tenants).toFixed(1) : 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Trucks/Company</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.tenants ? (data.trucks / data.tenants).toFixed(1) : 0}</p></CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MasterStats;

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const MasterBilling = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: subsData } = await supabase.from('subscriptions').select('*, tenants(name)');
      setSubs(subsData || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const activeSubs = subs.filter(s => s.status === 'active');
  const totalMRR = activeSubs.reduce((s, sub) => s + Number(sub.price_monthly || 0), 0);
  const pendingSubs = subs.filter(s => s.status === 'pending_payment');

  const planBreakdown = {
    basic: subs.filter(s => s.plan === 'basic').length,
    intermediate: subs.filter(s => s.plan === 'intermediate').length,
    pro: subs.filter(s => s.plan === 'pro').length,
  };

  const markPaid = async (subId: string) => {
    await supabase.from('subscriptions').update({ status: 'active', next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }).eq('id', subId);
    toast.success('Payment recorded');
    const { data } = await supabase.from('subscriptions').select('*, tenants(name)');
    setSubs(data || []);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Subscription Billing</h1>
        <p className="page-description">Manage company payments and subscriptions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Total MRR" value={`$${totalMRR.toLocaleString()}`} icon={DollarSign} iconClassName="bg-success/10 text-success" />
        <StatCard title="Active Subscriptions" value={activeSubs.length} icon={CheckCircle} iconClassName="bg-green-100 text-green-600" />
        <StatCard title="Pending Payments" value={pendingSubs.length} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Total Companies" value={subs.length} icon={Clock} iconClassName="bg-info/10 text-info" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Basic Plan</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{planBreakdown.basic}</p>
            <p className="text-xs text-muted-foreground">{planBreakdown.basic} × $199 = ${(planBreakdown.basic * 199).toLocaleString()}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Intermediate Plan</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{planBreakdown.intermediate}</p>
            <p className="text-xs text-muted-foreground">{planBreakdown.intermediate} × $399 = ${(planBreakdown.intermediate * 399).toLocaleString()}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pro Plan</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{planBreakdown.pro}</p>
            <p className="text-xs text-muted-foreground">{planBreakdown.pro} × $799 = ${(planBreakdown.pro * 799).toLocaleString()}/mo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Subscription Status</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-right p-3 font-medium text-muted-foreground">$/mo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Next Payment</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Action</th>
            </tr></thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{(s.tenants as any)?.name || '—'}</td>
                  <td className="p-3"><Badge className={s.plan === 'pro' ? 'bg-amber-100 text-amber-700' : s.plan === 'intermediate' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>{s.plan?.toUpperCase()}</Badge></td>
                  <td className="p-3 text-right font-semibold">${Number(s.price_monthly).toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{s.next_payment_date ? new Date(s.next_payment_date).toLocaleDateString() : '—'}</td>
                  <td className="p-3">
                    <Badge className={s.status === 'active' ? 'bg-green-100 text-green-700' : s.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                      {s.status === 'active' ? 'Current' : s.status === 'pending_payment' ? 'Pending' : s.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    {s.status === 'pending_payment' && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(s.id)}>Mark as Paid</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterBilling;

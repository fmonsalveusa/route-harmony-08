import { useMemo } from 'react';
import { useDriverPayments, DriverPayment } from '@/hooks/useDriverPayments';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { format, parseISO } from 'date-fns';

function MonthlyBreakdown({ payments }: { payments: DriverPayment[] }) {
  const monthly = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number }>();
    for (const p of payments) {
      const date = p.payment_date || p.created_at;
      const key = format(parseISO(date), 'yyyy-MM');
      const entry = map.get(key) || { paid: 0, pending: 0 };
      const amount = p.net_amount ?? p.amount;
      if (p.status === 'paid') entry.paid += amount;
      else entry.pending += amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([key, val]) => ({ label: format(parseISO(key + '-01'), 'MMM yyyy'), ...val }));
  }, [payments]);

  if (monthly.length === 0) return null;

  const maxVal = Math.max(...monthly.map(m => m.paid + m.pending), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Monthly Breakdown</h2>
      </div>
      <Card>
        <CardContent className="p-3 space-y-3">
          {monthly.map(m => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground">
                  ${(m.paid + m.pending).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                {m.paid > 0 && (
                  <div
                    className="h-full bg-success rounded-l-full"
                    style={{ width: `${(m.paid / maxVal) * 100}%` }}
                  />
                )}
                {m.pending > 0 && (
                  <div
                    className="h-full bg-warning"
                    style={{ width: `${(m.pending / maxVal) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Paid</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Pending</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentPayments({ payments }: { payments: DriverPayment[] }) {
  const recent = payments.slice(0, 8);
  if (recent.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Recent Payments</h2>
      <div className="space-y-2">
        {recent.map(p => (
          <Card key={p.id} className={`border-l-[3px] ${p.status === 'paid' ? 'border-l-success' : 'border-l-warning'}`}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Load #{p.load_reference}</p>
                {p.recipient_name && (
                  <p className="text-xs text-muted-foreground truncate">Driver: {p.recipient_name}</p>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="text-sm font-bold">${(p.net_amount ?? p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <Badge className={`text-[10px] ${p.status === 'paid' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}`}>
                  {p.status === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InvestorDashboard() {
  const { profile } = useAuth();
  const {
    investorPayments, loading,
    investorTotalPending, investorTotalPaid,
    refetch,
  } = useDriverPayments();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const totalEarnings = investorTotalPaid + investorTotalPending;

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="p-5 space-y-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
        <div>
          <h1 className="text-2xl font-bold">Hello, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-base text-muted-foreground">Investment overview</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="overflow-hidden">
            <CardContent className="p-3 flex flex-col items-center gap-1.5 bg-primary/5">
              <div className="p-2 rounded-full bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <p className="text-[10px] font-medium text-muted-foreground">Total</p>
              <p className="text-lg font-bold">${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 flex flex-col items-center gap-1.5 bg-success/5">
              <div className="p-2 rounded-full bg-success/10"><TrendingUp className="h-5 w-5 text-success" /></div>
              <p className="text-[10px] font-medium text-muted-foreground">Paid</p>
              <p className="text-lg font-bold text-success">${investorTotalPaid.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 flex flex-col items-center gap-1.5 bg-warning/5">
              <div className="p-2 rounded-full bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
              <p className="text-[10px] font-medium text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-warning">${investorTotalPending.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
        </div>

        <MonthlyBreakdown payments={investorPayments} />
        <RecentPayments payments={investorPayments} />

        {investorPayments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No investor payments yet.</p>
        )}
      </div>
    </PullToRefresh>
  );
}

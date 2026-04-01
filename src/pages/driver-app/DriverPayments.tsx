import { useDriverPayments, DriverPayment } from '@/hooks/useDriverPayments';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, Clock, MapPin, Landmark } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';

function shortLocation(address: string): string {
  if (!address) return '—';
  const parts = address.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = parts[i].match(/\b([A-Z]{2})\b/);
    if (match) {
      const city = parts[i - 1] || parts[0];
      return `${city}, ${match[1]}`;
    }
  }
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
}

function SummaryCards({ paid, pending }: { paid: number; pending: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-col items-center gap-2 bg-success/5">
          <div className="p-2 rounded-full bg-success/10"><TrendingUp className="h-6 w-6 text-success" /></div>
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className="text-xl font-bold text-success">${paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-col items-center gap-2 bg-warning/5">
          <div className="p-2 rounded-full bg-warning/10"><Clock className="h-6 w-6 text-warning" /></div>
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <p className="text-xl font-bold text-warning">${pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentList({ payments }: { payments: DriverPayment[] }) {
  if (payments.length === 0) return <p className="text-base text-muted-foreground text-center py-8">No payments yet</p>;

  return (
    <div className="space-y-2">
      {payments.map(p => {
        const adjAmount = p.total_adjustments ?? 0;
        return (
          <Card key={p.id} className={`border-l-[3px] ${p.status === 'paid' ? 'border-l-success' : 'border-l-warning'}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold">Load #{p.load_reference}</p>
                <Badge className={p.status === 'paid' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                  {p.status === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
              {(p.driver_name || p.recipient_name) && (
                <p className="text-xs text-muted-foreground">Driver: {p.driver_name || p.recipient_name}</p>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{shortLocation(p.origin || '')} → {shortLocation(p.destination || '')}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">${Number(p.total_rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">% Assigned</span>
                  <span className="font-medium">{p.percentage_applied}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adjustment</span>
                  <span className={`font-medium ${adjAmount > 0 ? 'text-success' : adjAmount < 0 ? 'text-destructive' : ''}`}>
                    {adjAmount === 0 ? '—' : `${adjAmount > 0 ? '+' : ''}$${Math.abs(adjAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid Date</span>
                  <span className="font-medium">{p.payment_date ? formatDate(p.payment_date) : '—'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-sm font-medium text-muted-foreground">Total Paid</span>
                <span className="text-base font-bold">${(p.net_amount ?? p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function DriverPayments() {
  const { role } = useAuth();
  const {
    payments, investorPayments, loading,
    totalPending, totalPaid,
    investorTotalPending, investorTotalPaid,
    refetch,
  } = useDriverPayments();

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const isInvestorOnly = role === 'investor';
  const hasInvestorPayments = investorPayments.length > 0;

  // Investor-only users: show only investor payments, no tabs
  if (isInvestorOnly) {
    return (
      <PullToRefresh onRefresh={refetch}>
        <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-4">
          <h1 className="text-xl font-bold">Investor Payments</h1>
          <SummaryCards paid={investorTotalPaid} pending={investorTotalPending} />
          <PaymentList payments={investorPayments} />
        </div>
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-4">
        {hasInvestorPayments ? (
          <Tabs defaultValue="driver">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">My Payments</h1>
            </div>
            <TabsList className="w-full mt-2">
              <TabsTrigger value="driver" className="flex-1 gap-1.5">
                <TrendingUp className="h-4 w-4" /> Driver
              </TabsTrigger>
              <TabsTrigger value="investor" className="flex-1 gap-1.5">
                <Landmark className="h-4 w-4" /> Investor
              </TabsTrigger>
            </TabsList>
            <TabsContent value="driver" className="space-y-4">
              <SummaryCards paid={totalPaid} pending={totalPending} />
              <PaymentList payments={payments} />
            </TabsContent>
            <TabsContent value="investor" className="space-y-4">
              <SummaryCards paid={investorTotalPaid} pending={investorTotalPending} />
              <PaymentList payments={investorPayments} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <h1 className="text-xl font-bold">My Payments</h1>
            <SummaryCards paid={totalPaid} pending={totalPending} />
            <PaymentList payments={payments} />
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

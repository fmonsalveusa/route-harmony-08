import { useDriverPayments } from '@/hooks/useDriverPayments';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

export default function DriverPayments() {
  const { payments, loading, totalPending, totalPaid } = useDriverPayments();

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-lg font-bold">My Payments</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-success/10"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-lg font-bold text-success">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-lg font-bold text-warning">${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>
        ) : (
          payments.map(p => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{p.load_reference}</p>
                  <p className="text-xs text-muted-foreground">{p.percentage_applied}% of ${Number(p.total_rate).toLocaleString()}</p>
                  {p.payment_date && <p className="text-xs text-muted-foreground">Paid: {p.payment_date}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <Badge className={p.status === 'paid' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                    {p.status === 'paid' ? 'Paid' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import { useDriverPayments } from '@/hooks/useDriverPayments';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

/** Extract "City, ST" from a full address */
function shortLocation(address: string): string {
  if (!address) return '—';
  const parts = address.split(',').map(s => s.trim());
  // Find the part containing a 2-letter state code
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = parts[i].match(/\b([A-Z]{2})\b/);
    if (match) {
      // The city is the part right before the state part
      const city = parts[i - 1] || parts[0];
      return `${city}, ${match[1]}`;
    }
  }
  // Fallback: first two parts
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
}

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
          payments.map(p => {
            const adjAmount = p.total_adjustments ?? 0;
            return (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  {/* Header: Load # + Status */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Load #{p.load_reference}</p>
                    <Badge className={p.status === 'paid' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                      {p.status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>

                  {/* Origin → Destination */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{shortLocation(p.origin || '')} → {shortLocation(p.destination || '')}</span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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

                  {/* Total */}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground">Total Paid</span>
                    <span className="text-sm font-bold">${(p.net_amount ?? p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

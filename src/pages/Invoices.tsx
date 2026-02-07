import { mockInvoices } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

const Invoices = () => {
  const totalPending = mockInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalPaid = mockInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Facturación</h1>
        <p className="page-description">Gestión de facturas y cobros</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pendientes" value={`$${totalPending.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Cobradas" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Facturado" value={`$${(totalPending + totalPaid).toLocaleString()}`} icon={DollarSign} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Factura</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Emisión</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Vencimiento</th>
              </tr></thead>
              <tbody>
                {mockInvoices.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-primary">{inv.id.toUpperCase()}</td>
                    <td className="p-3">{inv.clientName}</td>
                    <td className="p-3 text-right font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="p-3"><StatusBadge status={inv.status} /></td>
                    <td className="p-3 text-muted-foreground">{inv.issueDate}</td>
                    <td className="p-3 text-muted-foreground">{inv.dueDate}</td>
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

export default Invoices;

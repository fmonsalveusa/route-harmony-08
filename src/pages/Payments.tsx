import { useState } from 'react';
import { mockPayments } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, CheckCircle, Clock, Download } from 'lucide-react';

interface PaymentsPageProps {
  type: 'driver' | 'investor' | 'dispatcher';
  title: string;
  description: string;
}

const PaymentsPage = ({ type, title, description }: PaymentsPageProps) => {
  const [statusFilter, setStatusFilter] = useState('all');
  let payments = mockPayments.filter(p => p.recipientType === type);
  if (statusFilter !== 'all') payments = payments.filter(p => p.status === statusFilter);

  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Exportar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Pendiente" value={`$${totalPending.toLocaleString()}`} icon={Clock} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Total Pagado" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total General" value={`$${(totalPending + totalPaid).toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="processing">Procesando</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Beneficiario</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acción</th>
              </tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-primary">{p.loadReference}</td>
                    <td className="p-3">{p.recipientName}</td>
                    <td className="p-3 text-right font-semibold">${p.amount.toLocaleString()}</td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3 text-muted-foreground">{p.date || '—'}</td>
                    <td className="p-3 text-right">
                      {p.status === 'pending' && (
                        <Button size="sm" variant="outline" className="text-xs h-7">Marcar Pagado</Button>
                      )}
                    </td>
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

export const PaymentsDrivers = () => <PaymentsPage type="driver" title="Pagos a Conductores" description="Gestión de pagos pendientes y realizados a drivers" />;
export const PaymentsInvestors = () => <PaymentsPage type="investor" title="Pagos a Investors" description="Gestión de pagos a inversionistas por camión" />;
export const PaymentsDispatchers = () => <PaymentsPage type="dispatcher" title="Pagos a Dispatchers" description="Gestión de comisiones y pagos a dispatchers" />;

import { useState, useMemo } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { formatDate } from '@/lib/dateUtils';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, DollarSign, AlertTriangle, CheckCircle, Search, Trash2, ExternalLink, Send } from 'lucide-react';

const Invoices = () => {
  const { invoices, loading, updateInvoice, deleteInvoice } = useInvoices();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (search) result = result.filter(i =>
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      i.broker_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.company_name || '').toLowerCase().includes(search.toLowerCase())
    );
    return result;
  }, [invoices, statusFilter, search]);

  const pending = invoices.filter(i => i.status === 'pending');
  const sent = invoices.filter(i => i.status === 'sent');
  const paid = invoices.filter(i => i.status === 'paid');
  const totalPending = pending.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = paid.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Facturación</h1>
        <p className="page-description">Gestión de facturas generadas a brokers</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Pendientes" value={`$${totalPending.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Enviadas" value={sent.length} icon={Send} iconClassName="bg-info/10 text-info" />
        <StatCard title="Cobradas" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Facturas" value={invoices.length} icon={FileText} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, broker o empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Empresa</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Fecha</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {invoices.length === 0 ? 'No hay facturas generadas. Genera una desde la página de Cargas.' : 'No se encontraron resultados.'}
                  </td></tr>
                )}
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="p-3">{inv.broker_name}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{inv.company_name || '—'}</td>
                    <td className="p-3 text-right font-semibold">${Number(inv.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <Select value={inv.status} onValueChange={val => updateInvoice(inv.id, { status: val })}>
                        <SelectTrigger className="h-8 w-[120px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:ml-1">
                          <StatusBadge status={`invoice_${inv.status}`} className="text-sm px-3 py-1" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><StatusBadge status="invoice_pending" /></SelectItem>
                          <SelectItem value="sent"><StatusBadge status="invoice_sent" /></SelectItem>
                          <SelectItem value="paid"><StatusBadge status="invoice_paid" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{formatDate(inv.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" className="h-8 w-10 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => setDeleteTarget(inv.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) deleteInvoice(deleteTarget); setDeleteTarget(null); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;

import { useState, useMemo, useEffect } from 'react';
import { useDispatchServiceInvoices, DSInvoice } from '@/hooks/useDispatchServiceInvoices';
import { useDrivers, DbDriver } from '@/hooks/useDrivers';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/dateUtils';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { FileText, DollarSign, AlertTriangle, CheckCircle, Search, Trash2, Pencil, Plus } from 'lucide-react';

interface LoadForDS {
  id: string;
  reference_number: string;
  origin: string;
  destination: string;
  total_rate: number;
  delivery_date: string | null;
  pickup_date: string | null;
}

export function DispatchServiceTab() {
  const { invoices, loading, getNextInvoiceNumber, createInvoice, updateInvoice, deleteInvoice } = useDispatchServiceInvoices();
  const { drivers } = useDrivers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Generate invoice dialog state
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [availableLoads, setAvailableLoads] = useState<LoadForDS[]>([]);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadsLoading, setLoadsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');

  const dsDrivers = useMemo(() => drivers.filter(d => d.service_type === 'dispatch_service'), [drivers]);

  const selectedDriver = useMemo(() => dsDrivers.find(d => d.id === selectedDriverId), [dsDrivers, selectedDriverId]);
  const percentage = (selectedDriver as any)?.dispatch_service_percentage ?? 0;

  // Get all load IDs already invoiced
  const invoicedLoadIds = useMemo(() => {
    const ids = new Set<string>();
    invoices.forEach(inv => {
      if (Array.isArray(inv.loads)) {
        inv.loads.forEach((l: any) => ids.add(l.id || l.load_id));
      }
    });
    return ids;
  }, [invoices]);

  // Fetch loads for selected driver
  useEffect(() => {
    if (!selectedDriverId) { setAvailableLoads([]); return; }
    setLoadsLoading(true);
    supabase.from('loads')
      .select('id, reference_number, origin, destination, total_rate, delivery_date, pickup_date')
      .eq('driver_id', selectedDriverId)
      .eq('status', 'delivered')
      .order('delivery_date', { ascending: false })
      .then(({ data }) => {
        const loads = ((data as any) || []).filter((l: LoadForDS) => !invoicedLoadIds.has(l.id));
        setAvailableLoads(loads);
        setSelectedLoadIds(new Set(loads.map((l: LoadForDS) => l.id)));
        setLoadsLoading(false);
      });
  }, [selectedDriverId, invoicedLoadIds]);

  const selectedLoads = availableLoads.filter(l => selectedLoadIds.has(l.id));
  const totalAmount = selectedLoads.reduce((sum, l) => sum + (Number(l.total_rate) * percentage / 100), 0);

  const toggleLoad = (id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!selectedDriver || selectedLoads.length === 0) return;
    setGenerating(true);
    const invoiceNumber = await getNextInvoiceNumber();
    const loadsData = selectedLoads.map(l => ({
      id: l.id,
      reference_number: l.reference_number,
      origin: l.origin,
      destination: l.destination,
      total_rate: Number(l.total_rate),
      fee: Number(l.total_rate) * percentage / 100,
    }));
    await createInvoice({
      driver_id: selectedDriverId,
      driver_name: selectedDriver.name,
      invoice_number: invoiceNumber,
      loads: loadsData,
      total_amount: totalAmount,
      percentage_applied: percentage,
      status: 'pending',
      notes: notes || null,
      period_from: null,
      period_to: null,
    });
    setShowGenerate(false);
    setSelectedDriverId('');
    setNotes('');
    setGenerating(false);
  };

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (search) result = result.filter(i =>
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      i.driver_name.toLowerCase().includes(search.toLowerCase())
    );
    return result;
  }, [invoices, statusFilter, search]);

  const pending = invoices.filter(i => i.status === 'pending');
  const paid = invoices.filter(i => i.status === 'paid');
  const totalPending = pending.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPaid = paid.reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Pendiente" value={`$${totalPending.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Cobrado" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Facturas DS" value={invoices.length} icon={FileText} />
        <div className="flex items-end">
          <Button onClick={() => { setShowGenerate(true); setSelectedDriverId(''); setNotes(''); }} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Generar Factura DS
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número o driver..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Cargas</th>
                <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Fecha</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {invoices.length === 0 ? 'No hay facturas de Dispatch Service.' : 'Sin resultados.'}
                  </td></tr>
                )}
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="p-3">{inv.driver_name}</td>
                    <td className="p-3 text-right">{Array.isArray(inv.loads) ? inv.loads.length : 0}</td>
                    <td className="p-3 text-right">{inv.percentage_applied}%</td>
                    <td className="p-3 text-right font-semibold">${Number(inv.total_amount).toLocaleString()}</td>
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
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-red-400 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 gap-1" onClick={async () => { if (window.confirm(`¿Eliminar factura ${inv.invoice_number}?`)) { await deleteInvoice(inv.id); } }}>
                          <Trash2 className="h-4 w-4" /> Delete
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

      {/* Generate DS Invoice Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generar Factura Dispatch Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Driver (Dispatch Service)</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar driver..." /></SelectTrigger>
                <SelectContent>
                  {dsDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {(d as any).dispatch_service_percentage || 0}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDriverId && (
              <>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <span className="text-sm font-medium text-orange-700">Porcentaje DS: {percentage}%</span>
                  <span className="text-sm text-orange-600">|</span>
                  <span className="text-sm font-bold text-orange-800">Total: ${totalAmount.toFixed(2)}</span>
                </div>

                {loadsLoading ? (
                  <p className="text-center text-muted-foreground py-4">Cargando cargas...</p>
                ) : availableLoads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hay cargas entregadas sin facturar para este driver.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50 border-b">
                        <th className="p-2 w-10"><Checkbox checked={selectedLoadIds.size === availableLoads.length} onCheckedChange={(checked) => { setSelectedLoadIds(checked ? new Set(availableLoads.map(l => l.id)) : new Set()); }} /></th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Ref #</th>
                        <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Origen</th>
                        <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Destino</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Fee ({percentage}%)</th>
                      </tr></thead>
                      <tbody>
                        {availableLoads.map(load => {
                          const fee = Number(load.total_rate) * percentage / 100;
                          return (
                            <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-2"><Checkbox checked={selectedLoadIds.has(load.id)} onCheckedChange={() => toggleLoad(load.id)} /></td>
                              <td className="p-2 font-medium">{load.reference_number}</td>
                              <td className="p-2 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">{load.origin}</td>
                              <td className="p-2 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">{load.destination}</td>
                              <td className="p-2 text-right">${Number(load.total_rate).toLocaleString()}</td>
                              <td className="p-2 text-right font-semibold text-orange-600">${fee.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <Label>Notas (opcional)</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales..." />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={generating || selectedLoads.length === 0}>
              {generating ? 'Generando...' : `Generar Factura ($${totalAmount.toFixed(2)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { FileText, AlertTriangle, CheckCircle, Search, Trash2, Plus, Users, Download } from 'lucide-react';
import { generateDSInvoicePdf } from '@/lib/dsInvoicePdf';

interface LoadForDS {
  id: string;
  reference_number: string;
  origin: string;
  destination: string;
  total_rate: number;
  delivery_date: string | null;
  pickup_date: string | null;
  driver_id: string;
}

interface DriverLoadsGroup {
  driver: DbDriver;
  loads: LoadForDS[];
  percentage: number;
}

export function DispatchServiceTab() {
  const { invoices, loading, getNextInvoiceNumber, createInvoice, updateInvoice, deleteInvoice } = useDispatchServiceInvoices();
  const { drivers } = useDrivers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Generate invoice dialog state
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [driverLoadsMap, setDriverLoadsMap] = useState<Record<string, LoadForDS[]>>({});
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadsLoading, setLoadsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');

  const dsDrivers = useMemo(() => drivers.filter(d => d.service_type === 'dispatch_service'), [drivers]);

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

  const toggleDriver = (driverId: string) => {
    setSelectedDriverIds(prev => {
      const next = new Set(prev);
      if (next.has(driverId)) {
        next.delete(driverId);
        // Remove loads for this driver from selection
        const driverLoads = driverLoadsMap[driverId] || [];
        setSelectedLoadIds(prevLoads => {
          const nextLoads = new Set(prevLoads);
          driverLoads.forEach(l => nextLoads.delete(l.id));
          return nextLoads;
        });
      } else {
        next.add(driverId);
      }
      return next;
    });
  };

  // Fetch loads for all selected drivers
  useEffect(() => {
    const driverIds = Array.from(selectedDriverIds);
    if (driverIds.length === 0) {
      setDriverLoadsMap({});
      setSelectedLoadIds(new Set());
      return;
    }

    setLoadsLoading(true);
    supabase.from('loads')
      .select('id, reference_number, origin, destination, total_rate, delivery_date, pickup_date, driver_id')
      .in('driver_id', driverIds)
      .eq('status', 'delivered')
      .order('delivery_date', { ascending: false })
      .then(({ data }) => {
        const allLoads = ((data as any) || []).filter((l: LoadForDS) => !invoicedLoadIds.has(l.id));
        const map: Record<string, LoadForDS[]> = {};
        driverIds.forEach(id => { map[id] = []; });
        allLoads.forEach((l: LoadForDS) => {
          if (map[l.driver_id]) map[l.driver_id].push(l);
        });
        setDriverLoadsMap(map);
        // Auto-select all loads
        setSelectedLoadIds(new Set(allLoads.map((l: LoadForDS) => l.id)));
        setLoadsLoading(false);
      });
  }, [selectedDriverIds, invoicedLoadIds]);

  // Build grouped data
  const driverGroups: DriverLoadsGroup[] = useMemo(() => {
    return Array.from(selectedDriverIds).map(dId => {
      const driver = dsDrivers.find(d => d.id === dId);
      if (!driver) return null;
      return {
        driver,
        loads: (driverLoadsMap[dId] || []).filter(l => selectedLoadIds.has(l.id)),
        percentage: (driver as any).dispatch_service_percentage ?? 0,
      };
    }).filter(Boolean) as DriverLoadsGroup[];
  }, [selectedDriverIds, dsDrivers, driverLoadsMap, selectedLoadIds]);

  const totalAmount = driverGroups.reduce((sum, g) =>
    sum + g.loads.reduce((s, l) => s + (Number(l.total_rate) * g.percentage / 100), 0), 0);

  const allAvailableLoads = Object.values(driverLoadsMap).flat();

  const toggleLoad = (id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (driverGroups.length === 0) return;
    const totalSelectedLoads = driverGroups.reduce((s, g) => s + g.loads.length, 0);
    if (totalSelectedLoads === 0) return;

    setGenerating(true);
    const invoiceNumber = await getNextInvoiceNumber();
    const loadsData = driverGroups.flatMap(g =>
      g.loads.map(l => ({
        id: l.id,
        reference_number: l.reference_number,
        origin: l.origin,
        destination: l.destination,
        total_rate: Number(l.total_rate),
        fee: Number(l.total_rate) * g.percentage / 100,
        driver_id: g.driver.id,
        driver_name: g.driver.name,
        percentage: g.percentage,
      }))
    );

    const driverNames = driverGroups.map(g => g.driver.name).join(', ');
    const driverIdsStr = driverGroups.map(g => g.driver.id).join(',');

    await createInvoice({
      driver_id: driverIdsStr,
      driver_name: driverNames,
      invoice_number: invoiceNumber,
      loads: loadsData,
      total_amount: totalAmount,
      percentage_applied: driverGroups.length === 1 ? driverGroups[0].percentage : 0,
      status: 'pending',
      notes: notes || null,
      period_from: null,
      period_to: null,
    });
    setShowGenerate(false);
    setSelectedDriverIds(new Set());
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

  const openGenerateDialog = () => {
    setShowGenerate(true);
    setSelectedDriverIds(new Set());
    setDriverLoadsMap({});
    setSelectedLoadIds(new Set());
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pendiente" value={`$${totalPending.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Cobrado" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Facturas DS" value={invoices.length} icon={FileText} />
      </div>

      <div>
        <Button onClick={openGenerateDialog} className="gap-2">
          <Plus className="h-4 w-4" /> Generar Factura DS
        </Button>
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
                <th className="text-left p-3 font-medium text-muted-foreground">Driver(s)</th>
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
                    <td className="p-3 text-right">{inv.percentage_applied ? `${inv.percentage_applied}%` : 'Varios'}</td>
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
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-emerald-400 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 gap-1" onClick={() => {
                          const loads = Array.isArray(inv.loads) ? inv.loads : [];
                          generateDSInvoicePdf({
                            invoiceNumber: inv.invoice_number,
                            driverName: inv.driver_name,
                            loads: loads.map((l: any) => ({
                              reference_number: l.reference_number || '',
                              origin: l.origin || '',
                              destination: l.destination || '',
                              total_rate: Number(l.total_rate || 0),
                              fee: Number(l.fee || 0),
                              driver_name: l.driver_name || inv.driver_name,
                              percentage: Number(l.percentage || inv.percentage_applied || 0),
                            })),
                            totalAmount: Number(inv.total_amount),
                            createdAt: inv.created_at,
                            notes: inv.notes,
                          });
                        }}>
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 gap-1" onClick={async () => { if (window.confirm(`¿Eliminar factura ${inv.invoice_number}?`)) { await deleteInvoice(inv.id); } }}>
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

      {/* Generate DS Invoice Dialog - Multi-driver */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Generar Factura Dispatch Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Driver selection with checkboxes */}
            <div>
              <Label className="mb-2 block">Seleccionar Drivers (Dispatch Service)</Label>
              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                {dsDrivers.length === 0 ? (
                  <p className="p-4 text-center text-muted-foreground text-sm">No hay drivers con Service Type: Dispatch Service</p>
                ) : (
                  <div className="divide-y">
                    {dsDrivers.map(d => (
                      <label key={d.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={selectedDriverIds.has(d.id)}
                          onCheckedChange={() => toggleDriver(d.id)}
                        />
                        <span className="text-sm font-medium flex-1">{d.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {(d as any).dispatch_service_percentage || 0}%
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedDriverIds.size > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedDriverIds.size} driver(s) seleccionado(s)</p>
              )}
            </div>

            {selectedDriverIds.size > 0 && (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-accent/50 border border-accent">
                  <span className="text-sm font-medium">{selectedDriverIds.size} Driver(s)</span>
                  <span className="text-sm text-muted-foreground">|</span>
                  <span className="text-sm">{allAvailableLoads.filter(l => selectedLoadIds.has(l.id)).length} Cargas</span>
                  <span className="text-sm text-muted-foreground">|</span>
                  <span className="text-sm font-bold">Total: ${totalAmount.toFixed(2)}</span>
                </div>

                {loadsLoading ? (
                  <p className="text-center text-muted-foreground py-4">Cargando cargas...</p>
                ) : allAvailableLoads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hay cargas entregadas sin facturar para los drivers seleccionados.</p>
                ) : (
                  /* Loads grouped by driver */
                  <div className="space-y-4">
                    {Array.from(selectedDriverIds).map(dId => {
                      const driver = dsDrivers.find(d => d.id === dId);
                      if (!driver) return null;
                      const dLoads = driverLoadsMap[dId] || [];
                      const pct = (driver as any).dispatch_service_percentage ?? 0;
                      if (dLoads.length === 0) return (
                        <div key={dId} className="border rounded-lg p-3">
                          <p className="text-sm font-medium">{driver.name} <span className="text-muted-foreground">({pct}%)</span></p>
                          <p className="text-xs text-muted-foreground mt-1">Sin cargas entregadas sin facturar.</p>
                        </div>
                      );
                      return (
                        <div key={dId} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                            <span className="text-sm font-semibold">{driver.name}</span>
                            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{pct}%</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/30">
                              <th className="p-2 w-10">
                                <Checkbox
                                  checked={dLoads.every(l => selectedLoadIds.has(l.id))}
                                  onCheckedChange={(checked) => {
                                    setSelectedLoadIds(prev => {
                                      const next = new Set(prev);
                                      dLoads.forEach(l => { if (checked) next.add(l.id); else next.delete(l.id); });
                                      return next;
                                    });
                                  }}
                                />
                              </th>
                              <th className="text-left p-2 font-medium text-muted-foreground">Ref #</th>
                              <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Origen</th>
                              <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Destino</th>
                              <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                              <th className="text-right p-2 font-medium text-muted-foreground">Fee ({pct}%)</th>
                            </tr></thead>
                            <tbody>
                              {dLoads.map(load => {
                                const fee = Number(load.total_rate) * pct / 100;
                                return (
                                  <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-2"><Checkbox checked={selectedLoadIds.has(load.id)} onCheckedChange={() => toggleLoad(load.id)} /></td>
                                    <td className="p-2 font-medium">{load.reference_number}</td>
                                    <td className="p-2 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">{load.origin}</td>
                                    <td className="p-2 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">{load.destination}</td>
                                    <td className="p-2 text-right">${Number(load.total_rate).toLocaleString()}</td>
                                    <td className="p-2 text-right font-semibold text-primary">${fee.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
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
            <Button onClick={handleGenerate} disabled={generating || driverGroups.reduce((s, g) => s + g.loads.length, 0) === 0}>
              {generating ? 'Generando...' : `Generar Factura ($${totalAmount.toFixed(2)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

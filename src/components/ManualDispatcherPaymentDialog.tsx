import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateUtils';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface DispatcherOption {
  id: string;
  name: string;
  commission_percentage: number;
  dispatch_service_percentage: number;
}

interface LoadOption {
  id: string;
  reference_number: string;
  broker_client: string | null;
  total_rate: number;
  created_at: string;
  driver_id: string | null;
  origin: string;
  destination: string;
}

export const ManualDispatcherPaymentDialog = ({ open, onOpenChange, onComplete }: Props) => {
  const [dispatchers, setDispatchers] = useState<DispatcherOption[]>([]);
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>('');
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [driverServiceTypes, setDriverServiceTypes] = useState<Record<string, string>>({});

  // Fetch dispatchers
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('dispatchers').select('id, name, commission_percentage, dispatch_service_percentage').eq('status', 'active').order('name');
      setDispatchers((data as DispatcherOption[]) || []);
    })();
  }, [open]);

  // When dispatcher changes, fetch their loads without existing dispatcher payments
  const fetchLoads = useCallback(async (dispatcherId: string) => {
    setLoadingLoads(true);
    setSelectedLoadIds(new Set());

    // Get loads for this dispatcher
    const { data: loadsData } = await supabase
      .from('loads')
      .select('id, reference_number, broker_client, total_rate, created_at, driver_id, origin, destination')
      .eq('dispatcher_id', dispatcherId)
      .order('created_at', { ascending: false });

    if (!loadsData || loadsData.length === 0) {
      setLoads([]);
      setLoadingLoads(false);
      return;
    }

    // Get existing dispatcher payments for these loads
    const loadIds = loadsData.map((l: any) => l.id);
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('load_id')
      .eq('recipient_type', 'dispatcher')
      .eq('recipient_id', dispatcherId)
      .in('load_id', loadIds);

    const paidLoadIds = new Set((existingPayments || []).map((p: any) => p.load_id));
    const availableLoads = (loadsData as LoadOption[]).filter(l => !paidLoadIds.has(l.id));

    // Fetch driver service types for available loads
    const driverIds = [...new Set(availableLoads.map(l => l.driver_id).filter(Boolean))] as string[];
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase.from('drivers').select('id, service_type').in('id', driverIds);
      if (drivers) {
        const map: Record<string, string> = {};
        (drivers as any[]).forEach(d => { map[d.id] = d.service_type; });
        setDriverServiceTypes(map);
      }
    }

    setLoads(availableLoads);
    setLoadingLoads(false);
  }, []);

  const handleDispatcherChange = (id: string) => {
    setSelectedDispatcherId(id);
    fetchLoads(id);
  };

  const toggleLoad = (id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLoadIds.size === loads.length) {
      setSelectedLoadIds(new Set());
    } else {
      setSelectedLoadIds(new Set(loads.map(l => l.id)));
    }
  };

  const dispatcher = dispatchers.find(d => d.id === selectedDispatcherId);

  const selectedTotal = loads
    .filter(l => selectedLoadIds.has(l.id))
    .reduce((sum, l) => {
      const driverSvc = l.driver_id ? (driverServiceTypes[l.driver_id] || 'owner_operator') : 'owner_operator';
      const pct = driverSvc === 'dispatch_service'
        ? (dispatcher?.dispatch_service_percentage ?? 0)
        : (dispatcher?.commission_percentage ?? 0);
      return sum + (Number(l.total_rate) * pct / 100);
    }, 0);

  const handleSubmit = async () => {
    if (!dispatcher || selectedLoadIds.size === 0) return;
    setSubmitting(true);

    const paymentsToInsert = loads
      .filter(l => selectedLoadIds.has(l.id))
      .map(l => {
        const driverSvc = l.driver_id ? (driverServiceTypes[l.driver_id] || 'owner_operator') : 'owner_operator';
        const pct = driverSvc === 'dispatch_service'
          ? (dispatcher.dispatch_service_percentage ?? 0)
          : (dispatcher.commission_percentage ?? 0);
        const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;
        return {
          load_id: l.id,
          recipient_type: 'dispatcher',
          recipient_id: dispatcher.id,
          recipient_name: dispatcher.name,
          load_reference: l.reference_number,
          amount,
          percentage_applied: pct,
          total_rate: Number(l.total_rate),
        };
      });

    const { error } = await supabase.from('payments').insert(paymentsToInsert);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${paymentsToInsert.length} pago(s) generado(s) manualmente` });
      onComplete();
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedDispatcherId('');
      setLoads([]);
      setSelectedLoadIds(new Set());
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generar Pago Manual — Dispatcher</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Dispatcher selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Dispatcher</label>
            <Select value={selectedDispatcherId} onValueChange={handleDispatcherChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar dispatcher..." /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {dispatchers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} — {d.commission_percentage}% / DS {d.dispatch_service_percentage}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loads list */}
          {selectedDispatcherId && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Cargas disponibles ({loads.length})</label>
                {loads.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                    {selectedLoadIds.size === loads.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </Button>
                )}
              </div>

              {loadingLoads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : loads.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No hay cargas pendientes de pago para este dispatcher
                </p>
              ) : (
                <div className="overflow-auto flex-1 border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 sticky top-0">
                        <th className="p-2 w-8"></th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Referencia</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Fecha Creación</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Broker</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">%</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loads.map(l => {
                        const driverSvc = l.driver_id ? (driverServiceTypes[l.driver_id] || 'owner_operator') : 'owner_operator';
                        const pct = driverSvc === 'dispatch_service'
                          ? (dispatcher?.dispatch_service_percentage ?? 0)
                          : (dispatcher?.commission_percentage ?? 0);
                        const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;

                        return (
                          <tr key={l.id} className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${selectedLoadIds.has(l.id) ? 'bg-primary/5' : ''}`} onClick={() => toggleLoad(l.id)}>
                            <td className="p-2">
                              <Checkbox checked={selectedLoadIds.has(l.id)} onCheckedChange={() => toggleLoad(l.id)} />
                            </td>
                            <td className="p-2 font-medium text-primary">{l.reference_number}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(l.created_at)}</td>
                            <td className="p-2 text-muted-foreground">{l.broker_client || '—'}</td>
                            <td className="p-2 text-right">${Number(l.total_rate).toLocaleString()}</td>
                            <td className="p-2 text-right">{pct}%</td>
                            <td className="p-2 text-right font-semibold">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedLoadIds.size > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-semibold">
              <span>{selectedLoadIds.size} carga(s) seleccionada(s)</span>
              <span className="text-lg text-primary">${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={selectedLoadIds.size === 0 || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generar {selectedLoadIds.size > 0 ? `${selectedLoadIds.size} Pago(s)` : 'Pagos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

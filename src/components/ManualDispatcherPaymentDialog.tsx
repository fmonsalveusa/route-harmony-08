import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
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
  commission_2_percentage: number;
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
  dispatcher_pay_amount: number | null;
  service_type: string | null;
}

interface DriverOption {
  id: string;
  name: string;
  service_type: string;
}

export const ManualDispatcherPaymentDialog = ({ open, onOpenChange, onComplete }: Props) => {
  const [dispatchers, setDispatchers] = useState<DispatcherOption[]>([]);
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>('');
  const [allLoads, setAllLoads] = useState<LoadOption[]>([]);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverServiceTypes, setDriverServiceTypes] = useState<Record<string, string>>({});

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [driverFilter, setDriverFilter] = useState('all');

  // Fetch dispatchers
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('dispatchers').select('id, name, commission_percentage, commission_2_percentage, dispatch_service_percentage').eq('status', 'active').order('name');
      setDispatchers((data as DispatcherOption[]) || []);
    })();
  }, [open]);

  // When dispatcher changes, fetch their loads without existing dispatcher payments
  const fetchLoads = useCallback(async (dispatcherId: string) => {
    setLoadingLoads(true);
    setSelectedLoadIds(new Set());
    setDriverFilter('all');
    setDateFrom('');
    setDateTo('');

    const { data: loadsData } = await supabase
      .from('loads')
      .select('id, reference_number, broker_client, total_rate, created_at, driver_id, origin, destination, dispatcher_pay_amount, service_type')
      .eq('dispatcher_id', dispatcherId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (!loadsData || loadsData.length === 0) {
      setAllLoads([]);
      setDrivers([]);
      setLoadingLoads(false);
      return;
    }

    // Get existing dispatcher payments for these loads (check both payments table and items table)
    const loadIds = loadsData.map((l: any) => l.id);
    
    // Check dispatcher_payment_items for consolidated payments
    const { data: existingItems } = await supabase
      .from('dispatcher_payment_items')
      .select('load_id')
      .in('load_id', loadIds);

    // Also check legacy individual payments
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('load_id')
      .eq('recipient_type', 'dispatcher')
      .eq('recipient_id', dispatcherId)
      .in('load_id', loadIds);

    const paidLoadIds = new Set([
      ...((existingItems || []).map((p: any) => p.load_id)),
      ...((existingPayments || []).map((p: any) => p.load_id)),
    ]);
    const availableLoads = (loadsData as LoadOption[]).filter(l => !paidLoadIds.has(l.id));

    // Fetch driver info for available loads
    const driverIds = [...new Set(availableLoads.map(l => l.driver_id).filter(Boolean))] as string[];
    if (driverIds.length > 0) {
      const { data: driversData } = await supabase.from('drivers').select('id, name, service_type').in('id', driverIds);
      if (driversData) {
        setDrivers(driversData as DriverOption[]);
        const map: Record<string, string> = {};
        (driversData as DriverOption[]).forEach(d => { map[d.id] = d.service_type; });
        setDriverServiceTypes(map);
      }
    } else {
      setDrivers([]);
      setDriverServiceTypes({});
    }

    setAllLoads(availableLoads);
    setLoadingLoads(false);
  }, []);

  const handleDispatcherChange = (id: string) => {
    setSelectedDispatcherId(id);
    fetchLoads(id);
  };

  // Filtered loads based on date range and driver
  const filteredLoads = useMemo(() => {
    let result = allLoads;

    if (driverFilter !== 'all') {
      result = result.filter(l => l.driver_id === driverFilter);
    }

    if (dateFrom) {
      result = result.filter(l => {
        const d = l.created_at.split('T')[0];
        return d >= dateFrom;
      });
    }

    if (dateTo) {
      result = result.filter(l => {
        const d = l.created_at.split('T')[0];
        return d <= dateTo;
      });
    }

    return result;
  }, [allLoads, driverFilter, dateFrom, dateTo]);

  // Clear selection when filters change
  useEffect(() => { setSelectedLoadIds(new Set()); }, [driverFilter, dateFrom, dateTo]);

  const toggleLoad = (id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLoadIds.size === filteredLoads.length) {
      setSelectedLoadIds(new Set());
    } else {
      setSelectedLoadIds(new Set(filteredLoads.map(l => l.id)));
    }
  };

  const dispatcher = dispatchers.find(d => d.id === selectedDispatcherId);

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return '—';
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || '—';
  };

  /** Calculate dispatcher commission for a load, using stored value or fallback */
  const calcCommission = (l: LoadOption) => {
    // If the load already has a stored dispatcher_pay_amount > 0, use it
    const stored = Number(l.dispatcher_pay_amount ?? 0);
    if (stored > 0) {
      const rate = Number(l.total_rate);
      const pct = rate > 0 ? Math.round((stored / rate) * 10000) / 100 : 0;
      return { amount: Math.round(stored * 100) / 100, pct };
    }
    // Fallback: recalculate based on load's service_type and driver's service_type
    if (!dispatcher) return { amount: 0, pct: 0 };
    const loadSvcType = l.service_type;
    const driverSvc = loadSvcType || (l.driver_id ? (driverServiceTypes[l.driver_id] || 'owner_operator') : 'owner_operator');
    let pct: number;
    if (driverSvc === 'dispatch_service') {
      pct = dispatcher.dispatch_service_percentage ?? 0;
    } else {
      // Use commission_1 as default
      pct = dispatcher.commission_percentage ?? 0;
    }
    const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;
    return { amount, pct };
  };

  const selectedTotal = filteredLoads
    .filter(l => selectedLoadIds.has(l.id))
    .reduce((sum, l) => sum + calcCommission(l).amount, 0);

  const handleSubmit = async () => {
    if (!dispatcher || selectedLoadIds.size === 0) return;
    setSubmitting(true);

    const tenant_id = await getTenantId();
    const selectedLoads = filteredLoads.filter(l => selectedLoadIds.has(l.id));

    // Build individual line items
    const lineItems = selectedLoads.map(l => {
      const { amount, pct } = calcCommission(l);
      return { load: l, pct, amount };
    });

    const totalAmount = lineItems.reduce((s, i) => s + i.amount, 0);
    const totalRate = lineItems.reduce((s, i) => s + Number(i.load.total_rate), 0);

    // Generate consecutive INVD number
    const { data: lastPayment } = await supabase
      .from('payments')
      .select('load_reference')
      .eq('recipient_type', 'dispatcher')
      .like('load_reference', 'INVD-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (lastPayment?.load_reference) {
      const match = (lastPayment.load_reference as string).match(/^INVD-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const invdNumber = `INVD-${String(nextNum).padStart(4, '0')}`;

    // Insert ONE single consolidated payment using first load_id for FK constraint
    const { data: paymentData, error } = await supabase.from('payments').insert({
      load_id: selectedLoads[0].id,
      recipient_type: 'dispatcher',
      recipient_id: dispatcher.id,
      recipient_name: dispatcher.name,
      load_reference: invdNumber,
      amount: Math.round(totalAmount * 100) / 100,
      percentage_applied: lineItems[0].pct,
      total_rate: Math.round(totalRate * 100) / 100,
      tenant_id,
    } as any).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    // Insert individual load items into junction table
    const items = lineItems.map(i => ({
      payment_id: (paymentData as any).id,
      load_id: i.load.id,
      load_reference: i.load.reference_number,
      total_rate: Number(i.load.total_rate),
      percentage_applied: i.pct,
      amount: i.amount,
      tenant_id,
    }));

    const { error: itemsError } = await supabase.from('dispatcher_payment_items').insert(items);
    if (itemsError) {
      console.error('Error inserting payment items:', itemsError);
    }

    toast({ title: `Consolidated payment generated for ${selectedLoads.length} load(s)` });
    onComplete();
    onOpenChange(false);
    setSubmitting(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedDispatcherId('');
      setAllLoads([]);
      setSelectedLoadIds(new Set());
      setDrivers([]);
      setDateFrom('');
      setDateTo('');
      setDriverFilter('all');
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Dispatcher Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Dispatcher selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Dispatcher</label>
            <Select value={selectedDispatcherId} onValueChange={handleDispatcherChange}>
              <SelectTrigger><SelectValue placeholder="Select dispatcher..." /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {dispatchers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} — C1: {d.commission_percentage}%{d.commission_2_percentage > 0 ? ` / C2: ${d.commission_2_percentage}%` : ''}{d.dispatch_service_percentage > 0 ? ` / DS: ${d.dispatch_service_percentage}%` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range & Driver filters */}
          {selectedDispatcherId && !loadingLoads && allLoads.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From (Load Created)</label>
                <Input type="date" className="h-8 w-[150px] text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To (Load Created)</label>
                <Input type="date" className="h-8 w-[150px] text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Driver</label>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="All Drivers" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">All Drivers</SelectItem>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Loads list */}
          {selectedDispatcherId && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Available Loads ({filteredLoads.length})</label>
                {filteredLoads.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                    {selectedLoadIds.size === filteredLoads.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {loadingLoads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLoads.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No pending loads for this dispatcher{(dateFrom || dateTo || driverFilter !== 'all') ? ' with the selected filters' : ''}
                </p>
              ) : (
                <div className="overflow-auto flex-1 border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 sticky top-0">
                        <th className="p-2 w-8"></th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Reference</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Created</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Driver</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Broker</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">%</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoads.map(l => {
                        const { amount, pct } = calcCommission(l);

                        return (
                          <tr key={l.id} className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${selectedLoadIds.has(l.id) ? 'bg-primary/5' : ''}`} onClick={() => toggleLoad(l.id)}>
                            <td className="p-2">
                              <Checkbox checked={selectedLoadIds.has(l.id)} onCheckedChange={() => toggleLoad(l.id)} />
                            </td>
                            <td className="p-2 font-medium text-primary">{l.reference_number}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(l.created_at)}</td>
                            <td className="p-2 text-muted-foreground">{getDriverName(l.driver_id)}</td>
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
              <span>{selectedLoadIds.size} load(s) selected</span>
              <span className="text-lg text-primary">${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={selectedLoadIds.size === 0 || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Consolidated Payment{selectedLoadIds.size > 0 ? ` (${selectedLoadIds.size} loads)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

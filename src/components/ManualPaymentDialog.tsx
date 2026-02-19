import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateUtils';
import { Loader2, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientType: 'driver' | 'investor';
  onComplete: () => void;
}

interface RecipientOption {
  id: string;
  name: string;
  pay_percentage: number;
  investor_pay_percentage: number | null;
  investor_name: string | null;
}

interface LoadOption {
  id: string;
  reference_number: string;
  broker_client: string | null;
  total_rate: number;
  created_at: string;
  origin: string;
  destination: string;
}

export const ManualPaymentDialog = ({ open, onOpenChange, recipientType, onComplete }: Props) => {
  const [drivers, setDrivers] = useState<RecipientOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [allLoads, setAllLoads] = useState<LoadOption[]>([]);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch drivers that can receive this payment type
  useEffect(() => {
    if (!open) return;
    (async () => {
      let query = supabase.from('drivers').select('id, name, pay_percentage, investor_pay_percentage, investor_name').neq('status', 'inactive').order('name');
      // For investors, only show drivers that have an investor
      const { data } = await query;
      let options = (data as RecipientOption[]) || [];
      if (recipientType === 'investor') {
        options = options.filter(d => d.investor_name && (d.investor_pay_percentage ?? 0) > 0);
      }
      setDrivers(options);
    })();
  }, [open, recipientType]);

  // When driver changes, fetch loads without existing payments of this type
  const fetchLoads = useCallback(async (driverId: string) => {
    setLoadingLoads(true);
    setSelectedLoadIds(new Set());
    setDateFrom('');
    setDateTo('');

    const { data: loadsData } = await supabase
      .from('loads')
      .select('id, reference_number, broker_client, total_rate, created_at, origin, destination')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (!loadsData || loadsData.length === 0) {
      setAllLoads([]);
      setLoadingLoads(false);
      return;
    }

    // Get existing payments of this type for these loads
    const loadIds = loadsData.map((l: any) => l.id);
    const driver = drivers.find(d => d.id === driverId);
    const recipientId = driverId;

    const { data: existingPayments } = await supabase
      .from('payments')
      .select('load_id')
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .in('load_id', loadIds);

    const paidLoadIds = new Set((existingPayments || []).map((p: any) => p.load_id));
    const availableLoads = (loadsData as LoadOption[]).filter(l => !paidLoadIds.has(l.id));

    setAllLoads(availableLoads);
    setLoadingLoads(false);
  }, [drivers, recipientType]);

  const handleDriverChange = (id: string) => {
    setSelectedDriverId(id);
    fetchLoads(id);
  };

  const filteredLoads = useMemo(() => {
    let result = allLoads;
    if (dateFrom) result = result.filter(l => l.created_at.split('T')[0] >= dateFrom);
    if (dateTo) result = result.filter(l => l.created_at.split('T')[0] <= dateTo);
    return result;
  }, [allLoads, dateFrom, dateTo]);

  useEffect(() => { setSelectedLoadIds(new Set()); }, [dateFrom, dateTo]);

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

  const driver = drivers.find(d => d.id === selectedDriverId);
  const pct = recipientType === 'investor'
    ? (driver?.investor_pay_percentage ?? 0)
    : (driver?.pay_percentage ?? 0);

  const selectedTotal = filteredLoads
    .filter(l => selectedLoadIds.has(l.id))
    .reduce((sum, l) => sum + (Number(l.total_rate) * pct / 100), 0);

  const handleSubmit = async () => {
    if (!driver || selectedLoadIds.size === 0) return;
    setSubmitting(true);

    const tenant_id = await getTenantId();
    const selectedLoads = filteredLoads.filter(l => selectedLoadIds.has(l.id));

    const recipientName = recipientType === 'investor' ? (driver.investor_name || driver.name) : driver.name;

    const paymentsToInsert = selectedLoads.map(l => {
      const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;
      return {
        load_id: l.id,
        recipient_type: recipientType,
        recipient_id: driver.id,
        recipient_name: recipientName,
        load_reference: l.reference_number,
        amount,
        percentage_applied: pct,
        total_rate: Number(l.total_rate),
        tenant_id,
      };
    });

    const { error } = await supabase.from('payments').insert(paymentsToInsert as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${paymentsToInsert.length} payment(s) created with pending status` });
      onComplete();
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedDriverId('');
      setAllLoads([]);
      setSelectedLoadIds(new Set());
      setDateFrom('');
      setDateTo('');
    }
    onOpenChange(o);
  };

  const recipientLabel = recipientType === 'investor' ? 'Investor' : 'Driver';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Manual {recipientLabel} Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Recipient selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium">{recipientLabel === 'Investor' ? 'Driver (Investor)' : 'Driver'}</label>
            <Select value={selectedDriverId} onValueChange={handleDriverChange}>
              <SelectTrigger><SelectValue placeholder={`Select ${recipientLabel.toLowerCase()}...`} /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {recipientType === 'investor' ? `${d.investor_name} (${d.name})` : d.name} — {pct}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date filters */}
          {selectedDriverId && !loadingLoads && allLoads.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input type="date" className="h-8 w-[150px] text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input type="date" className="h-8 w-[150px] text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          )}

          {/* Loads list */}
          {selectedDriverId && (
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
                  No unpaid loads for this {recipientLabel.toLowerCase()}{(dateFrom || dateTo) ? ' with the selected filters' : ''}
                </p>
              ) : (
                <div className="overflow-auto flex-1 border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 sticky top-0">
                        <th className="p-2 w-8"></th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Reference</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Route</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Broker</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">%</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoads.map(l => {
                        const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;
                        const route = `${l.origin?.split(',')[0] || ''} → ${l.destination?.split(',')[0] || ''}`;

                        return (
                          <tr key={l.id} className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${selectedLoadIds.has(l.id) ? 'bg-primary/5' : ''}`} onClick={() => toggleLoad(l.id)}>
                            <td className="p-2">
                              <Checkbox checked={selectedLoadIds.has(l.id)} onCheckedChange={() => toggleLoad(l.id)} />
                            </td>
                            <td className="p-2 font-medium text-primary">{l.reference_number}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(l.created_at)}</td>
                            <td className="p-2 text-muted-foreground text-xs">{route}</td>
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
            Create {selectedLoadIds.size > 0 ? `${selectedLoadIds.size} ` : ''}Payment{selectedLoadIds.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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

/**
 * Una opción del dropdown.
 * - Modo driver:   un registro por driver.
 * - Modo investor: un registro por PAR driver×investor (un driver puede tener 2 investors),
 *                  leído de driver_investors — no de los campos viejos en drivers.
 */
interface RecipientOption {
  key: string;            // único: driverId (driver) | `${driverId}::${investorName}` (investor)
  driverId: string;
  driverName: string;
  label: string;          // lo que se ve en el dropdown
  pct: number;            // % por defecto
  recipientName: string;  // lo que se guarda en payments.recipient_name
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

const CHUNK = 100;

export const ManualPaymentDialog = ({ open, onOpenChange, recipientType, onComplete }: Props) => {
  const [options, setOptions] = useState<RecipientOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [allLoads, setAllLoads] = useState<LoadOption[]>([]);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customPct, setCustomPct] = useState<number | null>(null);

  // Cargar opciones del dropdown
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: drvs, error: drvError } = await supabase
        .from('drivers')
        .select('id, name, pay_percentage')
        .neq('status', 'inactive')
        .order('name');

      if (drvError || !drvs) {
        console.error('drivers query error:', drvError);
        setOptions([]);
        return;
      }

      if (recipientType === 'driver') {
        setOptions(drvs.map((d: any) => ({
          key: d.id,
          driverId: d.id,
          driverName: d.name,
          label: d.name,
          pct: d.pay_percentage ?? 0,
          recipientName: d.name,
        })));
        return;
      }

      // Modo investor: pares driver×investor desde driver_investors (chunked por límite de PostgREST)
      const driverIds = drvs.map((d: any) => d.id);
      const driverNameById = new Map(drvs.map((d: any) => [d.id, d.name]));
      const links: any[] = [];

      for (let i = 0; i < driverIds.length; i += CHUNK) {
        const { data, error } = await supabase
          .from('driver_investors' as any)
          .select('driver_id, investor_name, pay_percentage')
          .eq('is_active', true)
          .in('driver_id', driverIds.slice(i, i + CHUNK));
        if (error) {
          console.error('driver_investors query error:', error);
          toast({ title: 'Error cargando investors', description: error.message, variant: 'destructive' });
          setOptions([]);
          return;
        }
        links.push(...(data || []));
      }

      const pairs = links
        .filter(l => l.investor_name)
        .map(l => ({
          key: `${l.driver_id}::${l.investor_name}`,
          driverId: l.driver_id,
          driverName: driverNameById.get(l.driver_id) || '',
          label: `${l.investor_name} (${driverNameById.get(l.driver_id) || '—'})`,
          pct: Number(l.pay_percentage) || 0,
          recipientName: l.investor_name as string,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setOptions(pairs);
    })();
  }, [open, recipientType]);

  // Cargas sin pago de este tipo para el recipient seleccionado
  const fetchLoads = useCallback(async (opt: RecipientOption) => {
    setLoadingLoads(true);
    setSelectedLoadIds(new Set());
    setDateFrom('');
    setDateTo('');

    const { data: loadsData, error: loadsError } = await supabase
      .from('loads')
      .select('id, reference_number, broker_client, total_rate, created_at, origin, destination')
      .eq('driver_id', opt.driverId)
      .order('created_at', { ascending: false });

    if (loadsError) {
      console.error('loads query error:', loadsError);
      toast({ title: 'Error cargando cargas', description: loadsError.message, variant: 'destructive' });
      setAllLoads([]);
      setLoadingLoads(false);
      return;
    }

    if (!loadsData || loadsData.length === 0) {
      setAllLoads([]);
      setLoadingLoads(false);
      return;
    }

    // Chequeo de pagos existentes — chunked y con manejo de error.
    // En modo investor filtramos también por recipient_name: un mismo driver puede tener
    // 2 investors, cada uno con su propio pago sobre la misma carga.
    const loadIds = loadsData.map((l: any) => l.id);
    const paidLoadIds = new Set<string>();
    let queryFailed = false;

    for (let i = 0; i < loadIds.length; i += CHUNK) {
      let q = supabase
        .from('payments')
        .select('load_id')
        .eq('recipient_type', recipientType)
        .eq('recipient_id', opt.driverId)
        .in('load_id', loadIds.slice(i, i + CHUNK));

      if (recipientType === 'investor') q = q.eq('recipient_name', opt.recipientName);

      const { data: pays, error: paysError } = await q;
      if (paysError) { console.error('payments error:', paysError); queryFailed = true; break; }
      (pays || []).forEach((p: any) => paidLoadIds.add(p.load_id));
    }

    if (queryFailed) {
      toast({
        title: 'Error verificando pagos',
        description: 'No se pudo confirmar qué cargas ya están pagadas. Intenta de nuevo.',
        variant: 'destructive',
      });
      setAllLoads([]);
      setLoadingLoads(false);
      return;
    }

    setAllLoads((loadsData as LoadOption[]).filter(l => !paidLoadIds.has(l.id)));
    setLoadingLoads(false);
  }, [recipientType]);

  const handleRecipientChange = (key: string) => {
    setSelectedKey(key);
    const opt = options.find(o => o.key === key);
    if (!opt) return;
    setCustomPct(opt.pct);
    fetchLoads(opt);
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

  const selectedOption = options.find(o => o.key === selectedKey);
  const pct = customPct ?? selectedOption?.pct ?? 0;

  const selectedTotal = filteredLoads
    .filter(l => selectedLoadIds.has(l.id))
    .reduce((sum, l) => sum + (Number(l.total_rate) * pct / 100), 0);

  const handleSubmit = async () => {
    if (!selectedOption || selectedLoadIds.size === 0) return;
    setSubmitting(true);

    const tenant_id = await getTenantId();
    const selectedLoads = filteredLoads.filter(l => selectedLoadIds.has(l.id));

    const paymentsToInsert = selectedLoads.map(l => {
      const amount = Math.round(Number(l.total_rate) * pct / 100 * 100) / 100;
      return {
        load_id: l.id,
        recipient_type: recipientType,
        recipient_id: selectedOption.driverId,
        recipient_name: selectedOption.recipientName,
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
      setSelectedKey('');
      setAllLoads([]);
      setSelectedLoadIds(new Set());
      setDateFrom('');
      setDateTo('');
      setCustomPct(null);
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
            <label className="text-sm font-medium">{recipientType === 'investor' ? 'Investor (Driver)' : 'Driver'}</label>
            <Select value={selectedKey} onValueChange={handleRecipientChange}>
              <SelectTrigger><SelectValue placeholder={`Select ${recipientLabel.toLowerCase()}...`} /></SelectTrigger>
              <SelectContent className="bg-popover z-50 max-h-72">
                {options.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    {recipientType === 'investor' ? 'No investors assigned' : 'No drivers'}
                  </div>
                ) : options.map(o => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label} — {o.pct}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom percentage */}
          {selectedKey && (
            <div className="space-y-1">
              <label className="text-sm font-medium">% Applied</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="w-[120px]"
                value={customPct ?? ''}
                onChange={e => setCustomPct(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          )}

          {/* Date filters */}
          {selectedKey && !loadingLoads && allLoads.length > 0 && (
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
          {selectedKey && (
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

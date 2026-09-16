import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTruckFixedCosts, DbTruckFixedCost } from '@/hooks/useTruckFixedCosts';
import { useTruckVariableCosts, DbTruckVariableCost } from '@/hooks/useTruckVariableCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { DbTruck } from '@/hooks/useTrucks';
import { Plus, Trash2, Settings, Pencil, Fuel, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: DbTruck[];
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FixedCostsDialog({ open, onOpenChange, trucks }: Props) {
  const { fixedCosts, createFixedCost, updateFixedCost, deleteFixedCost } = useTruckFixedCosts();
  const { variableCosts, createVariableCost, updateVariableCost, deleteVariableCost } = useTruckVariableCosts();
  const { settings, updateSettings } = useTenantSettings();
  const queryClient = useQueryClient();

  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [editing, setEditing] = useState<string | null>(null);

  // Variable cost form
  const [vTruckId, setVTruckId] = useState<string>('');
  const [vDescription, setVDescription] = useState('');
  const [vCostPerMile, setVCostPerMile] = useState('');
  const [vEditing, setVEditing] = useState<string | null>(null);

  // Settings form
  const [dieselPrice, setDieselPrice] = useState('');
  const [workingDays, setWorkingDays] = useState('');

  const handleAdd = async () => {
    if (!selectedTruckId || !description || !amount) return;
    if (editing) {
      await updateFixedCost(editing, { description, amount: parseFloat(amount), frequency });
      setEditing(null);
    } else {
      await createFixedCost({ truck_id: selectedTruckId, description, amount: parseFloat(amount), frequency });
    }
    setDescription('');
    setAmount('');
    setFrequency('monthly');
  };

  const handleEdit = (fc: DbTruckFixedCost) => {
    setSelectedTruckId(fc.truck_id);
    setDescription(fc.description);
    setAmount(fc.amount.toString());
    setFrequency(fc.frequency);
    setEditing(fc.id);
  };

  const handleCancel = () => {
    setEditing(null);
    setDescription('');
    setAmount('');
    setFrequency('monthly');
  };

  const handleAddVariable = async () => {
    if (!vTruckId || !vDescription || !vCostPerMile) return;
    if (vEditing) {
      await updateVariableCost(vEditing, { description: vDescription, cost_per_mile: parseFloat(vCostPerMile) });
      setVEditing(null);
    } else {
      await createVariableCost({ truck_id: vTruckId, description: vDescription, cost_per_mile: parseFloat(vCostPerMile) });
    }
    setVDescription('');
    setVCostPerMile('');
  };

  const handleEditVariable = (vc: DbTruckVariableCost) => {
    setVTruckId(vc.truck_id);
    setVDescription(vc.description);
    setVCostPerMile(String(vc.cost_per_mile));
    setVEditing(vc.id);
  };

  const updateMpg = async (truckId: string, mpg: string) => {
    const val = parseFloat(mpg);
    if (!Number.isFinite(val) || val <= 0) return;
    const { error } = await supabase.from('trucks').update({ mpg: val } as any).eq('id', truckId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['trucks'] });
    toast.success('MPG updated');
  };

  const monthlyFor = (truckId: string) => fixedCosts
    .filter(fc => fc.truck_id === truckId)
    .reduce((sum, fc) => {
      switch (fc.frequency) {
        case 'weekly': return sum + fc.amount * 4.33;
        case 'yearly': return sum + fc.amount / 12;
        default: return sum + fc.amount;
      }
    }, 0);

  const perMileFor = (truckId: string) => variableCosts
    .filter(vc => vc.truck_id === truckId)
    .reduce((sum, vc) => sum + Number(vc.cost_per_mile || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cost Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="fixed">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fixed">Fixed Costs</TabsTrigger>
            <TabsTrigger value="variable">Per Mile</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ═══ FIXED COSTS ═══ */}
          <TabsContent value="fixed" className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 bg-muted/30 rounded-lg border">
              <div>
                <Label className="text-xs">Truck</Label>
                <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {trucks.map(t => <SelectItem key={t.id} value={t.id}>#{t.unit_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Insurance, Leasing, etc." className="h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Amount</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-9 text-xs" />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs">Frequency</Label>
                <div className="flex gap-1">
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-9" onClick={handleAdd} disabled={!selectedTruckId || !description || !amount}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {editing && <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={handleCancel}>Cancel</Button>}
              </div>
            </div>

            {trucks.map(t => {
              const costs = fixedCosts.filter(fc => fc.truck_id === t.id);
              const monthly = monthlyFor(t.id);
              const daily = settings.working_days_per_month > 0 ? monthly / settings.working_days_per_month : 0;
              return (
                <div key={t.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                    <span className="font-medium text-sm">#{t.unit_number} — {t.make} {t.model}</span>
                    <span className="text-sm font-bold text-primary">
                      {fmt(monthly)}/mo · <span className="text-amber-600">{fmt(daily)}/día</span>
                    </span>
                  </div>
                  {costs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Frequency</TableHead>
                          <TableHead className="text-xs text-right">Monthly</TableHead>
                          <TableHead className="text-xs text-right">Daily</TableHead>
                          <TableHead className="text-xs w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costs.map(fc => {
                          const m = fc.frequency === 'weekly' ? fc.amount * 4.33 : fc.frequency === 'yearly' ? fc.amount / 12 : fc.amount;
                          const d = settings.working_days_per_month > 0 ? m / settings.working_days_per_month : 0;
                          return (
                            <TableRow key={fc.id}>
                              <TableCell className="text-xs">{fc.description}</TableCell>
                              <TableCell className="text-xs text-right">{fmt(fc.amount)}</TableCell>
                              <TableCell className="text-xs capitalize">{fc.frequency}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{fmt(m)}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-amber-600">{fmt(d)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(fc)}><Pencil className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFixedCost(fc.id)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground">No fixed costs configured</div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ═══ PER MILE COSTS ═══ */}
          <TabsContent value="variable" className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg border">
              <div>
                <Label className="text-xs">Truck</Label>
                <Select value={vTruckId} onValueChange={setVTruckId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {trucks.map(t => <SelectItem key={t.id} value={t.id}>#{t.unit_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Input value={vDescription} onChange={e => setVDescription(e.target.value)} placeholder="Maintenance Reserve, Tires..." className="h-9 text-xs" />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs">$ / mile</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.001" value={vCostPerMile} onChange={e => setVCostPerMile(e.target.value)} placeholder="0.120" className="h-9 text-xs flex-1" />
                  <Button size="sm" className="h-9" onClick={handleAddVariable} disabled={!vTruckId || !vDescription || !vCostPerMile}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {vEditing && <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => { setVEditing(null); setVDescription(''); setVCostPerMile(''); }}>Cancel</Button>}
              </div>
            </div>

            {trucks.map(t => {
              const costs = variableCosts.filter(vc => vc.truck_id === t.id);
              const total = perMileFor(t.id);
              return (
                <div key={t.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                    <span className="font-medium text-sm">#{t.unit_number} — {t.make} {t.model}</span>
                    <span className="text-sm font-bold text-primary">${total.toFixed(3)}/mi</span>
                  </div>
                  {costs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">$ / mile</TableHead>
                          <TableHead className="text-xs text-right">Per 1,000 mi</TableHead>
                          <TableHead className="text-xs w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costs.map(vc => (
                          <TableRow key={vc.id}>
                            <TableCell className="text-xs">{vc.description}</TableCell>
                            <TableCell className="text-xs text-right font-medium">${Number(vc.cost_per_mile).toFixed(3)}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">{fmt(Number(vc.cost_per_mile) * 1000)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditVariable(vc)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteVariableCost(vc.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground">No per-mile costs configured</div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ═══ SETTINGS ═══ */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Fuel className="h-3 w-3" /> Precio del diésel ($/galón)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={dieselPrice}
                    onChange={e => setDieselPrice(e.target.value)}
                    placeholder={String(settings.diesel_price_per_gallon)}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" className="h-9" disabled={!dieselPrice} onClick={async () => {
                    const ok = await updateSettings({ diesel_price_per_gallon: parseFloat(dieselPrice) });
                    if (ok) setDieselPrice('');
                  }}>Save</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Actual: ${settings.diesel_price_per_gallon.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Gauge className="h-3 w-3" /> Días laborables por mes</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={workingDays}
                    onChange={e => setWorkingDays(e.target.value)}
                    placeholder={String(settings.working_days_per_month)}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" className="h-9" disabled={!workingDays} onClick={async () => {
                    const ok = await updateSettings({ working_days_per_month: parseInt(workingDays) });
                    if (ok) setWorkingDays('');
                  }}>Save</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Actual: {settings.working_days_per_month} días</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium text-sm">MPG por camión</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Truck</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">MPG</TableHead>
                    <TableHead className="text-xs text-right">Costo diésel / milla</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trucks.map(t => {
                    const mpg = Number(t.mpg) || 0;
                    const perMile = mpg > 0 ? settings.diesel_price_per_gallon / mpg : 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs font-medium">#{t.unit_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.truck_type}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.1"
                            defaultValue={mpg || ''}
                            placeholder="7.5"
                            className="h-8 text-xs w-20 ml-auto text-right"
                            onBlur={e => { if (e.target.value !== String(mpg)) updateMpg(t.id, e.target.value); }}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium text-amber-600">
                          {perMile > 0 ? `$${perMile.toFixed(3)}` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

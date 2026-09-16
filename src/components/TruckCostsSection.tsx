import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, X, Fuel } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useTruckFixedCosts, type DbTruckFixedCost } from '@/hooks/useTruckFixedCosts';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import type { DbTruck } from '@/hooks/useTrucks';
import { toast } from 'sonner';

const COST_TYPES = [
  'Insurance',
  'Truck Payment',
  'Trailer Payment',
  'Maintenance',
  'Tires',
  'ELD',
  'Parking',
  'Registration',
  'Permits / IFTA',
  'Phone',
  'Other',
];

const FREQUENCIES = [
  { value: 'weekly', label: '1 week' },
  { value: 'monthly', label: '1 month' },
  { value: 'yearly', label: '1 year' },
  { value: 'per_mile', label: 'per mile' },
];

const money = (n: number, digits = 2) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const toMonthly = (fc: DbTruckFixedCost) => {
  switch (fc.frequency) {
    case 'weekly': return fc.amount * 4.33;
    case 'yearly': return fc.amount / 12;
    case 'per_mile': return 0;
    default: return fc.amount;
  }
};

function CostRow({ cost, onUpdate, onDelete }: {
  cost: DbTruckFixedCost;
  onUpdate: (id: string, input: Partial<DbTruckFixedCost>) => void;
  onDelete: (id: string) => void;
}) {
  const [amount, setAmount] = useState(String(cost.amount ?? ''));
  useEffect(() => { setAmount(String(cost.amount ?? '')); }, [cost.amount]);

  const types = COST_TYPES.includes(cost.description) ? COST_TYPES : [cost.description, ...COST_TYPES];
  const isPerMile = cost.frequency === 'per_mile';

  const saveAmount = () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n === Number(cost.amount)) return;
    onUpdate(cost.id, { amount: n });
  };

  return (
    <div className="grid grid-cols-[1fr_7.5rem_6.5rem_1.5rem] gap-2 items-center">
      <Select value={cost.description} onValueChange={(v) => onUpdate(cost.id, { description: v })}>
        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          step={isPerMile ? '0.001' : '0.01'}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onBlur={saveAmount}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="h-9 text-sm pl-6"
        />
      </div>

      <Select value={cost.frequency} onValueChange={(v) => onUpdate(cost.id, { frequency: v })}>
        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <button
        onClick={() => onDelete(cost.id)}
        className="text-muted-foreground hover:text-destructive transition-colors"
        title="Eliminar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TruckCostsSection({ truck }: { truck: DbTruck }) {
  const { fixedCosts, createFixedCost, updateFixedCost, deleteFixedCost } = useTruckFixedCosts();
  const { settings } = useTenantSettings();
  const queryClient = useQueryClient();
  const [mpg, setMpg] = useState(truck.mpg ? String(truck.mpg) : '');

  useEffect(() => { setMpg(truck.mpg ? String(truck.mpg) : ''); }, [truck.mpg]);

  const costs = fixedCosts.filter(fc => fc.truck_id === truck.id);
  const monthly = costs.reduce((s, fc) => s + toMonthly(fc), 0);
  const daily = settings.working_days_per_month > 0 ? monthly / settings.working_days_per_month : 0;
  const perMileCosts = costs.filter(fc => fc.frequency === 'per_mile').reduce((s, fc) => s + Number(fc.amount || 0), 0);
  const mpgNum = parseFloat(mpg) || 0;
  const fuelPerMile = mpgNum > 0 ? settings.diesel_price_per_gallon / mpgNum : 0;

  const saveMpg = async () => {
    const n = parseFloat(mpg);
    if (!Number.isFinite(n) || n <= 0 || n === Number(truck.mpg)) return;
    const { error } = await supabase.from('trucks').update({ mpg: n } as any).eq('id', truck.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['trucks'] });
    queryClient.invalidateQueries({ queryKey: ['profit_data', 'config_history'] });
  };

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-lg font-bold uppercase tracking-wide text-foreground border-b pb-2 mb-3">
        Costs &amp; Expenses
      </h3>
      <p className="text-xs text-muted-foreground -mt-1 mb-3">
        Los cambios aplican a las cargas desde hoy. Las cargas anteriores conservan los valores que tenían.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,32rem)_1fr] gap-6">
        {/* Filas editables */}
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_7.5rem_6.5rem_1.5rem] gap-2 text-xs font-medium text-muted-foreground">
            <span>Payment Type</span>
            <span>Amount</span>
            <span>Frequency</span>
            <span />
          </div>

          {costs.map(cost => (
            <CostRow
              key={cost.id}
              cost={cost}
              onUpdate={(id, input) => updateFixedCost(id, input as any, true)}
              onDelete={deleteFixedCost}
            />
          ))}

          <button
            onClick={() => createFixedCost({ truck_id: truck.id, description: 'Other', amount: 0, frequency: 'monthly' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-muted text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>

        {/* Resumen + MPG */}
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costos fijos / mes</span>
              <span className="font-semibold">{money(monthly)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Por día ({settings.working_days_per_month} días laborables)</span>
              <span className="font-semibold text-amber-600">{money(daily)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costos por milla</span>
              <span className="font-semibold">{money(perMileCosts, 3)}/mi</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diésel por milla</span>
              <span className="font-semibold">{fuelPerMile > 0 ? `${money(fuelPerMile, 3)}/mi` : '—'}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-medium">Total por milla</span>
              <span className="font-bold">{money(perMileCosts + fuelPerMile, 3)}/mi</span>
            </div>
          </div>

          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Fuel className="h-3 w-3" /> MPG
              </label>
              <Input
                type="number"
                step="0.1"
                value={mpg}
                placeholder="7.5"
                onChange={e => setMpg(e.target.value)}
                onBlur={saveMpg}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="h-9 w-24 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

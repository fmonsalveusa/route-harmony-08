import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import type { DbTruck } from '@/hooks/useTrucks';
import { Settings, Fuel, CalendarDays } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: DbTruck[];
}

/** Settings globales del cálculo de costos. Los costos de cada camión se editan en su detalle (Fleet). */
export function FixedCostsDialog({ open, onOpenChange }: Props) {
  const { settings, updateSettings } = useTenantSettings();
  const [dieselPrice, setDieselPrice] = useState('');
  const [workingDays, setWorkingDays] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cost Settings
          </DialogTitle>
          <DialogDescription>
            Valores globales. Los costos de cada camión se configuran en Fleet → detalle del camión → Costs &amp; Expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Fuel className="h-3 w-3" /> Precio del diésel ($/galón)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={dieselPrice}
                onChange={e => setDieselPrice(e.target.value)}
                placeholder={settings.diesel_price_per_gallon.toFixed(2)}
                className="h-9"
              />
              <Button size="sm" className="h-9" disabled={!dieselPrice} onClick={async () => {
                if (await updateSettings({ diesel_price_per_gallon: parseFloat(dieselPrice) })) setDieselPrice('');
              }}>Save</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Actual: ${settings.diesel_price_per_gallon.toFixed(2)}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Días laborables por mes</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={workingDays}
                onChange={e => setWorkingDays(e.target.value)}
                placeholder={String(settings.working_days_per_month)}
                className="h-9"
              />
              <Button size="sm" className="h-9" disabled={!workingDays} onClick={async () => {
                if (await updateSettings({ working_days_per_month: parseInt(workingDays) })) setWorkingDays('');
              }}>Save</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Actual: {settings.working_days_per_month} días</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

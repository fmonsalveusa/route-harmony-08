import { useEffect, useState } from 'react';
import { Fuel, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenantSettings, DIESEL_REGION_LABELS, type DieselRegion } from '@/hooks/useTenantSettings';

const shortDate = (d: string | null) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-');
  return y && m && day ? `${m}/${day}/${y}` : d;
};

/** Precio global del diésel: editable a mano o actualizado desde EIA */
export function DieselPriceControl({ showRegion = false, compact = false }: { showRegion?: boolean; compact?: boolean }) {
  const { settings, refreshing, setManualDieselPrice, refreshDieselPrice, updateSettings } = useTenantSettings();
  const [price, setPrice] = useState(settings.diesel_price_per_gallon.toFixed(2));

  useEffect(() => { setPrice(settings.diesel_price_per_gallon.toFixed(2)); }, [settings.diesel_price_per_gallon]);

  const save = () => {
    const n = parseFloat(price);
    if (!Number.isFinite(n) || n <= 0 || n.toFixed(2) === settings.diesel_price_per_gallon.toFixed(2)) {
      setPrice(settings.diesel_price_per_gallon.toFixed(2));
      return;
    }
    void setManualDieselPrice(n);
  };

  const meta = settings.diesel_price_source === 'eia'
    ? `EIA · ${DIESEL_REGION_LABELS[settings.diesel_price_region]}${settings.diesel_price_updated_at ? ` · semana ${shortDate(settings.diesel_price_updated_at)}` : ''}`
    : `Manual${settings.diesel_price_updated_at ? ` · ${shortDate(settings.diesel_price_updated_at)}` : ''}`;

  const shortMeta = settings.diesel_price_source === 'eia'
    ? `EIA ${DIESEL_REGION_LABELS[settings.diesel_price_region]}${settings.diesel_price_updated_at ? ` · ${shortDate(settings.diesel_price_updated_at).slice(0, 5)}` : ''}`
    : 'Manual';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" title={meta}>
        <Fuel className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Diésel</span>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-[84px] text-xs pl-5"
          />
        </div>
        <Select
          value={settings.diesel_price_region}
          onValueChange={async (v) => {
            if (await updateSettings({ diesel_price_region: v as DieselRegion }, true)) void refreshDieselPrice();
          }}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(DIESEL_REGION_LABELS) as DieselRegion[]).map(r => (
              <SelectItem key={r} value={r}>{DIESEL_REGION_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => void refreshDieselPrice()}
          disabled={refreshing}
          className="h-8 w-8 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
          title="Traer el último precio publicado por EIA"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{shortMeta}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Fuel className="h-3 w-3" /> Diésel ($/galón)
      </label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-9 w-28 text-sm pl-6"
          />
        </div>
        {showRegion && (
          <Select
            value={settings.diesel_price_region}
            onValueChange={async (v) => {
              if (await updateSettings({ diesel_price_region: v as DieselRegion }, true)) void refreshDieselPrice();
            }}
          >
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(DIESEL_REGION_LABELS) as DieselRegion[]).map(r => (
                <SelectItem key={r} value={r}>{DIESEL_REGION_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button
          onClick={() => void refreshDieselPrice()}
          disabled={refreshing}
          className="h-9 px-2.5 rounded-md border text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
          title="Traer el último precio publicado por EIA"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          EIA
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{meta}</p>
    </div>
  );
}

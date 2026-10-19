import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';

export interface LoadStopValue {
  loadId: string | null;
  reference: string;
  stopOrder: number | null;
}

interface LoadOption { id: string; reference_number: string; destination: string | null }
interface StopOption { stop_order: number; stop_type: string; address: string }

/**
 * Carga y parada del documento: al firmarse, el PDF firmado queda como POD (o BOL si es pickup)
 * de esa parada. Las paradas se muestran solo después de elegir la carga.
 */
export function LoadStopPicker({ value, onChange }: { value: LoadStopValue; onChange: (v: LoadStopValue) => void }) {
  const [query, setQuery] = useState(value.reference);
  const [options, setOptions] = useState<LoadOption[]>([]);
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<StopOption[]>([]);

  useEffect(() => { setQuery(value.reference); }, [value.reference]);

  // Cargas que coinciden con lo que se escribe
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      let req = supabase.from('loads').select('id, reference_number, destination')
        .neq('status', 'cancelled').order('pickup_date', { ascending: false, nullsFirst: false }).limit(8);
      if (q) req = req.ilike('reference_number', `%${q}%`);
      const { data } = await req;
      setOptions((data as LoadOption[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!value.loadId) { setStops([]); return; }
    supabase.from('load_stops').select('stop_order, stop_type, address').eq('load_id', value.loadId).order('stop_order')
      .then(({ data }) => setStops((data as StopOption[]) ?? []));
  }, [value.loadId]);

  const pick = (l: LoadOption) => {
    setOpen(false);
    onChange({ loadId: l.id, reference: l.reference_number, stopOrder: null });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value.trim()) onChange({ loadId: null, reference: '', stopOrder: null }); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Carga # (opcional)"
          className="w-40"
        />
        {open && options.length > 0 && (
          <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
            {options.map((l) => (
              <button key={l.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                <span className="font-medium">#{l.reference_number}</span>
                <span className="text-muted-foreground"> · {l.destination ?? ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {value.loadId && (
        <select
          value={value.stopOrder ?? ''}
          onChange={(e) => onChange({ ...value, stopOrder: e.target.value === '' ? null : Number(e.target.value) })}
          className="h-10 max-w-64 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Parada: última entrega</option>
          {stops.map((s) => (
            <option key={s.stop_order} value={s.stop_order}>
              {s.stop_type === 'pickup' ? 'Pickup' : 'Entrega'} · {String(s.address ?? '').slice(0, 45)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

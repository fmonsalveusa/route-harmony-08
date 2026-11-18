import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocPodLink {
  loadId: string | null;
  reference: string | null;
  stopOrder: number | null;
  attached: boolean;
}

interface LoadOption { id: string; reference_number: string; destination: string | null; delivery_date: string | null; status: string }
interface StopOption { stop_order: number; stop_type: string; address: string }

/**
 * Vincula un documento de firma a una carga: al firmarse, el PDF firmado queda como POD
 * de la entrega elegida (lo hace el trigger documents_attach_pod) y sale al broker con
 * "Delivery Completed" junto con las fotos de esa parada.
 */
export function DocumentPodDialog({ docId, docName, link, onClose, onSaved }: {
  docId: string; docName: string; link: DocPodLink; onClose: () => void; onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LoadOption | null>(null);
  const [stops, setStops] = useState<StopOption[]>([]);
  const [stopOrder, setStopOrder] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Cargas recientes, o las que coinciden con lo que se escribe
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let q = supabase.from('loads').select('id, reference_number, destination, delivery_date, status')
        .neq('status', 'cancelled').order('delivery_date', { ascending: false, nullsFirst: false }).limit(15);
      if (query.trim()) q = q.ilike('reference_number', `%${query.trim()}%`);
      const { data } = await q;
      if (!cancelled) { setLoads((data as LoadOption[]) ?? []); setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    if (!selected) { setStops([]); return; }
    supabase.from('load_stops').select('stop_order, stop_type, address').eq('load_id', selected.id)
      .order('stop_order').then(({ data }) => {
        const list = (data as StopOption[]) ?? [];
        setStops(list);
        const deliveries = list.filter((s) => s.stop_type === 'delivery');
        setStopOrder(deliveries.length ? deliveries[deliveries.length - 1].stop_order : null);
      });
  }, [selected]);

  const save = async (loadId: string | null) => {
    setSaving(true);
    const { error } = await supabase.from('documents' as any)
      .update({ pod_load_id: loadId, pod_stop_order: loadId ? stopOrder : null } as any).eq('id', docId);
    setSaving(false);
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    toast.success(loadId ? `Vinculado a la carga #${selected?.reference_number}` : 'Se quitó el vínculo');
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Usar como POD de una carga</DialogTitle>
          <DialogDescription className="text-sm text-[#444746] dark:text-muted-foreground">
            "{docName}": al firmarse, el PDF firmado queda como POD de la entrega y se envía al broker con
            "Delivery Completed", junto con las fotos de esa parada.
          </DialogDescription>
        </DialogHeader>

        {link.attached ? (
          <p className="text-sm">
            Ya está agregado como POD de la carga <strong>#{link.reference}</strong>. Para quitarlo, bórralo desde las fotos/POD de la parada en el detalle de la carga.
          </p>
        ) : (
          <div className="space-y-3">
            {link.loadId && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span>Vinculado a <strong>#{link.reference}</strong> (se agrega al firmarse)</span>
                <Button size="sm" variant="ghost" className="text-destructive rounded-full text-[#b3261e] hover:text-[#b3261e] hover:bg-[#fce8e6]" onClick={() => save(null)} disabled={saving}>Quitar</Button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar carga por número…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="max-h-64 overflow-auto rounded-md border divide-y">
              {searching ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : loads.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No se encontraron cargas</p>
              ) : loads.map((l) => (
                <button key={l.id} type="button" onClick={() => setSelected(l)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selected?.id === l.id ? 'bg-primary/10' : ''}`}>
                  <span className="font-medium">#{l.reference_number}</span>
                  <span className="text-muted-foreground"> · {l.destination ?? ''} · {l.delivery_date ?? ''} · {l.status}</span>
                </button>
              ))}
            </div>
            {selected && stops.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Parada</p>
                {stops.map((s) => (
                  <label key={s.stop_order} className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={stopOrder === s.stop_order} onChange={() => setStopOrder(s.stop_order)} />
                    <span className="text-muted-foreground">{s.stop_type === 'pickup' ? 'Pickup' : 'Entrega'} ·</span> {s.address}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button className="rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={() => save(selected!.id)} disabled={!selected || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Vincular
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

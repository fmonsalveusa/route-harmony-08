import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Download } from 'lucide-react';
import { generateBolPdf } from '@/lib/bolPdf';
import type { DbLoad } from '@/hooks/useLoads';
import type { Company } from '@/hooks/useCompanies';

interface BolLineItem {
  quantity: string;
  description: string;
  weight_lb: string;
  weight_kg: string;
}

interface LoadStop {
  id: string;
  stop_type: string;
  address: string;
  stop_order: number;
}

interface BolFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: DbLoad;
  stops: LoadStop[];
  company: Company | null;
}

const emptyItem = (): BolLineItem => ({ quantity: '', description: '', weight_lb: '', weight_kg: '' });

export const BolFormDialog = ({ open, onOpenChange, load, stops, company }: BolFormDialogProps) => {
  const [items, setItems] = useState<BolLineItem[]>([emptyItem()]);
  const [selectedOrigin, setSelectedOrigin] = useState<string>('default');
  const [selectedDestination, setSelectedDestination] = useState<string>('default');

  const pickupStops = useMemo(() => stops.filter(s => s.stop_type === 'pickup'), [stops]);
  const deliveryStops = useMemo(() => stops.filter(s => s.stop_type === 'delivery'), [stops]);
  const isMultiStop = stops.length > 2;

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof BolLineItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const originAddress = selectedOrigin === 'default'
    ? load.origin
    : stops.find(s => s.id === selectedOrigin)?.address || load.origin;

  const destinationAddress = selectedDestination === 'default'
    ? load.destination
    : stops.find(s => s.id === selectedDestination)?.address || load.destination;

  const handleGenerate = () => {
    generateBolPdf({
      bolNumber: load.reference_number,
      date: load.pickup_date,
      shipperAddress: originAddress,
      consigneeAddress: destinationAddress,
      carrierName: company?.name || '',
      company,
      items: items.filter(i => i.quantity || i.description || i.weight_lb),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Generar Bill of Lading — {load.reference_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Origin / Destination selectors for multi-stop */}
          {isMultiStop && (
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-xs font-semibold">Shipper (Origen)</Label>
                <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{load.origin}</SelectItem>
                    {pickupStops.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Consignee (Destino)</Label>
                <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{load.destination}</SelectItem>
                    {deliveryStops.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Non-multi-stop: just show addresses */}
          {!isMultiStop && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Shipper (Origen)</Label>
                <p className="mt-1 font-medium">{load.origin}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Consignee (Destino)</Label>
                <p className="mt-1 font-medium">{load.destination}</p>
              </div>
            </div>
          )}

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Artículos / Productos</Label>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addItem}>
                <Plus className="h-3 w-3" /> Agregar línea
              </Button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[60px_1fr_80px_80px_32px] gap-2 text-xs font-semibold text-muted-foreground px-1">
                <span>Cantidad</span>
                <span>Descripción</span>
                <span>Peso (Lb)</span>
                <span>Peso (Kg)</span>
                <span></span>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[60px_1fr_80px_80px_32px] gap-2 items-center">
                  <Input
                    placeholder="#"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Descripción del artículo..."
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Lb"
                    value={item.weight_lb}
                    onChange={e => updateItem(idx, 'weight_lb', e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Kg"
                    value={item.weight_kg}
                    onChange={e => updateItem(idx, 'weight_kg', e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} className="gap-1.5">
            <Download className="h-4 w-4" /> Generar BOL PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

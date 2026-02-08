import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { todayET } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatcher?: DbDispatcher | null;
  onSubmit: (data: DispatcherInput) => Promise<void>;
}

const emptyForm: DispatcherInput = {
  name: '', email: '', phone: '',
  status: 'active',
  commission_percentage: 8,
  dispatch_service_percentage: 0,
  pay_type: 'per_rate',
  start_date: todayET(),
};

export function DispatcherFormDialog({ open, onOpenChange, dispatcher, onSubmit }: Props) {
  const [form, setForm] = useState<DispatcherInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dispatcher) {
      setForm({
        name: dispatcher.name, email: dispatcher.email, phone: dispatcher.phone,
        status: dispatcher.status, commission_percentage: dispatcher.commission_percentage,
        dispatch_service_percentage: dispatcher.dispatch_service_percentage,
        pay_type: dispatcher.pay_type, start_date: dispatcher.start_date,
      });
    } else {
      setForm(emptyForm);
    }
  }, [dispatcher, open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('Nombre');
    if (!form.email.trim()) missing.push('Email');
    if (!form.phone.trim()) missing.push('Teléfono');
    if (missing.length > 0) {
      toast.error(`Campos requeridos: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
    onOpenChange(false);
  };

  const startDate = form.start_date ? new Date(form.start_date + 'T00:00:00') : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dispatcher ? 'Editar Dispatcher' : 'Nuevo Dispatcher'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@ejemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Teléfono *</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555-0000" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>% Comisión</Label>
            <Input type="number" value={form.commission_percentage} onChange={e => set('commission_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>% Dispatch Service</Label>
            <Input type="number" value={form.dispatch_service_percentage} onChange={e => set('dispatch_service_percentage', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Pago</Label>
            <Select value={form.pay_type} onValueChange={v => set('pay_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_rate">Por Tarifa</SelectItem>
                <SelectItem value="per_load">Por Carga</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'MM/dd/yyyy') : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={d => set('start_date', d ? format(d, 'yyyy-MM-dd') : form.start_date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : dispatcher ? 'Guardar Cambios' : 'Crear Dispatcher'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

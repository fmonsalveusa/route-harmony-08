import type { LucideIcon } from 'lucide-react';
import { Minus, ClipboardList, Send as SendIcon, Truck as TruckGo, MapPin as MapPinIcon, PackageCheck, MapPinned, CheckCircle2 as DoneIcon, Ban, XCircle as XIcon, Clock as ClockIcon, RefreshCw, AlertTriangle as WarnIcon, UserCheck, UserX, Layers } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface StatusChipOption {
  value: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Color sólido del círculo, p. ej. 'bg-[#188038]' */
  dot: string;
  /** Fondo tonal y color del texto de la pastilla */
  chip: string;
}

/** Tonos estándar (estilo Google) para las pastillas de status */
export const CHIP_TONE = {
  green: { dot: 'bg-[#188038]', chip: 'bg-[#188038] text-white hover:bg-[#137333]' },
  amber: { dot: 'bg-[#e37400]', chip: 'bg-[#e37400] text-white hover:bg-[#c56200]' },
  red: { dot: 'bg-[#d93025]', chip: 'bg-[#d93025] text-white hover:bg-[#b3261e]' },
  gray: { dot: 'bg-[#5f6368]', chip: 'bg-[#5f6368] text-white hover:bg-[#444746]' },
};

/** Status como pastilla tonal con círculo de color e ícono; al abrir muestra cada opción con su explicación */
export function StatusChipSelect({ value, options, onChange, disabled, placeholder }: {
  value: string;
  options: StatusChipOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Texto cuando el valor no está en la lista (p. ej. factoring sin definir) */
  placeholder?: string;
}) {
  const current: StatusChipOption = options.find(o => o.value === value)
    ?? { value: value || '', label: placeholder ?? (value || '—'), icon: Minus, ...CHIP_TONE.gray };
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        onClick={e => e.stopPropagation()}
        className={cn('h-auto w-auto gap-2 rounded-full border-0 pl-1 pr-3 py-1 shadow-none focus:ring-0 whitespace-nowrap disabled:opacity-100 disabled:cursor-default [&>span]:!flex [&>span]:items-center [&>span]:line-clamp-none [&>svg]:text-white [&>svg]:opacity-90', current.chip)}
      >
        <span className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full flex items-center justify-center text-white shrink-0 bg-white/20">
            <current.icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium">{current.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2.5 py-0.5">
              <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-white shrink-0', o.dot)}>
                <o.icon className="h-3 w-3" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm text-[#1f1f1f] dark:text-foreground">{o.label}</span>
                {o.hint && <span className="block text-[11px] text-[#444746] dark:text-muted-foreground">{o.hint}</span>}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Iniciales: nombre + primer apellido ("Carlos Alvarez" → "CA") */
export const initialsOf = (name: string | null | undefined) => {
  const w = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase() || '?';
};

/** Status de cargas (mismos colores que StatusBadge) */
export const LOAD_STATUS_CHIPS: StatusChipOption[] = [
  { value: 'planned', label: 'Planned', hint: 'Sin despachar', icon: ClipboardList, dot: 'bg-[#94A3B8]', chip: 'bg-[#94A3B8] text-white hover:bg-[#7c8ba0]' },
  { value: 'dispatched', label: 'Dispatched', hint: 'Asignada al driver', icon: SendIcon, dot: 'bg-[#2563EB]', chip: 'bg-[#2563EB] text-white hover:bg-[#1d4fd0]' },
  { value: 'in_transit', label: 'In Transit', hint: 'Rumbo al pickup', icon: TruckGo, dot: 'bg-[#65A30D]', chip: 'bg-[#65A30D] text-white hover:bg-[#538a0a]' },
  { value: 'on_site_pickup', label: 'On Site - Pickup', hint: 'En el shipper', icon: MapPinIcon, dot: 'bg-[#06B6D4]', chip: 'bg-[#06B6D4] text-white hover:bg-[#0599b3]' },
  { value: 'picked_up', label: 'Picked Up', hint: 'Cargado', icon: PackageCheck, dot: 'bg-[#D946EF]', chip: 'bg-[#D946EF] text-white hover:bg-[#c026d3]' },
  { value: 'on_site_delivery', label: 'On Site - Delivery', hint: 'En el receiver', icon: MapPinned, dot: 'bg-[#F97316]', chip: 'bg-[#F97316] text-white hover:bg-[#ea620c]' },
  { value: 'delivered', label: 'Delivered', hint: 'Entregada', icon: DoneIcon, dot: 'bg-[#178504]', chip: 'bg-[#178504] text-white hover:bg-[#126b03]' },
  { value: 'tonu', label: 'TONU', hint: 'Truck ordered not used', icon: Ban, dot: 'bg-[#B45309]', chip: 'bg-[#B45309] text-white hover:bg-[#984607]' },
  { value: 'cancelled', label: 'Canceled', hint: 'Cancelada', icon: XIcon, dot: 'bg-[#DC2626]', chip: 'bg-[#DC2626] text-white hover:bg-[#bd1f1f]' },
];

export const FACTORING_CHIPS: StatusChipOption[] = [
  { value: 'pending', label: 'Pending', hint: 'Falta enviar', icon: ClockIcon, dot: 'bg-[#e8a20c]', chip: 'bg-[#e8a20c] text-white hover:bg-[#cc8e0a]' },
  { value: 'in_progress', label: 'In Progress', hint: 'En proceso', icon: RefreshCw, dot: 'bg-[#266aad]', chip: 'bg-[#266aad] text-white hover:bg-[#1f5891]' },
  { value: 'waiting_for_adjustments', label: 'Waiting Adj.', hint: 'Esperando ajustes', icon: WarnIcon, dot: 'bg-[#dc2626]', chip: 'bg-[#dc2626] text-white hover:bg-[#bd1f1f]' },
  { value: 'ready', label: 'Ready', hint: 'Genera los pagos', icon: DoneIcon, dot: 'bg-[#178504]', chip: 'bg-[#178504] text-white hover:bg-[#126b03]' },
];

export const PAYMENT_STATUS_CHIPS: StatusChipOption[] = [
  { value: 'pending', label: 'Pending', hint: 'Por pagar', icon: ClockIcon, dot: 'bg-[#e8a20c]', chip: 'bg-[#e8a20c] text-white hover:bg-[#cc8e0a]' },
  { value: 'in_process', label: 'In Progress', hint: 'Pago en camino', icon: RefreshCw, dot: 'bg-[#266aad]', chip: 'bg-[#266aad] text-white hover:bg-[#1f5891]' },
  { value: 'paid', label: 'Paid', hint: 'Pagado', icon: DoneIcon, dot: 'bg-[#178504]', chip: 'bg-[#178504] text-white hover:bg-[#126b03]' },
];

export const INVOICE_STATUS_CHIPS: StatusChipOption[] = [
  { value: 'pending', label: 'Pending', hint: 'Sin enviar', icon: ClockIcon, dot: 'bg-[#e8a20c]', chip: 'bg-[#e8a20c] text-white hover:bg-[#cc8e0a]' },
  { value: 'sent', label: 'Sent', hint: 'Enviada al broker', icon: SendIcon, dot: 'bg-[#266aad]', chip: 'bg-[#266aad] text-white hover:bg-[#1f5891]' },
  { value: 'paid', label: 'Paid', hint: 'Cobrada', icon: DoneIcon, dot: 'bg-[#178504]', chip: 'bg-[#178504] text-white hover:bg-[#126b03]' },
];

export const ACTIVE_STATUS_CHIPS: StatusChipOption[] = [
  { value: 'active', label: 'Active', hint: 'Puede entrar a la app', icon: UserCheck, ...CHIP_TONE.green },
  { value: 'inactive', label: 'Inactive', hint: 'Acceso bloqueado', icon: UserX, ...CHIP_TONE.red },
];

/** Opción "todos" para filtros */
export const ALL_CHIP = (label: string): StatusChipOption => ({ value: 'all', label, icon: Layers, ...CHIP_TONE.gray });

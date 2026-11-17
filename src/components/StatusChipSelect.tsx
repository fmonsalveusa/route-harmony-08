import type { LucideIcon } from 'lucide-react';
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
export function StatusChipSelect({ value, options, onChange, disabled }: {
  value: string;
  options: StatusChipOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const current = options.find(o => o.value === value) ?? options[0];
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

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Buscador estilo Gmail: píldora gris que se pone blanca con sombra al escribir */
export const SEARCH_PILL =
  'h-10 rounded-full border border-transparent bg-[#e9eef6] dark:bg-muted/60 shadow-none text-sm text-[#1f1f1f] dark:text-foreground placeholder:text-[#444746] dark:placeholder:text-muted-foreground outline-none transition ' +
  'hover:bg-[#dde3ea] dark:hover:bg-muted focus:bg-white dark:focus:bg-card focus:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:shadow-[0_1px_1px_rgba(65,69,73,.3),0_1px_3px_1px_rgba(65,69,73,.15)]';

/** Filtro con el diseño del Dashboard: píldora blanca con borde gris fino */
export const FILTER_CHIP =
  'h-9 w-auto gap-1.5 rounded-full px-3 text-xs shadow-none focus:ring-1 focus:ring-[#0b57d0] focus:ring-offset-0 bg-white dark:bg-card border border-[#747775] dark:border-border text-[#1f1f1f] dark:text-foreground hover:bg-[#f0f4f9] dark:hover:bg-muted';

/**
 * Filtro con el diseño de los filtros del Dashboard: píldora blanca con borde gris
 * que muestra el valor elegido ("All Dispatchers", "Francisco Monsalve"...).
 * Cuando hay algo elegido aparece una X pequeña para quitarlo.
 */
export function FilterChip({
  value, onValueChange, label, resetValue = 'all', disabled, children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  /** Texto si el valor no tiene opción visible */
  label: string;
  /** Valor "sin filtro"; la X vuelve a este valor */
  resetValue?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const active = value !== resetValue;
  return (
    <div className="relative inline-flex">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn(FILTER_CHIP, 'min-w-[110px] max-w-[260px] justify-between', active && 'pr-8 [&>svg:last-child]:hidden')}>
          <span className="truncate"><SelectValue placeholder={label} /></span>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">{children}</SelectContent>
      </Select>
      {active && !disabled && (
        <button
          type="button"
          title="Quitar filtro"
          onClick={e => { e.stopPropagation(); onValueChange(resetValue); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-[#444746] dark:text-muted-foreground hover:bg-[#e3e8ef] dark:hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Botón "Limpiar filtros" (texto azul) */
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 rounded-full text-xs font-medium text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-muted"
    >
      Limpiar filtros
    </button>
  );
}

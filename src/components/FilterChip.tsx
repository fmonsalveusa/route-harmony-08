import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Buscador estilo Gmail: píldora gris que se pone blanca con sombra al escribir */
export const SEARCH_PILL =
  'h-10 rounded-full border border-transparent bg-[#e9eef6] dark:bg-muted/60 shadow-none text-sm text-[#1f1f1f] dark:text-foreground placeholder:text-[#444746] dark:placeholder:text-muted-foreground outline-none transition ' +
  'hover:bg-[#dde3ea] dark:hover:bg-muted focus:bg-white dark:focus:bg-card focus:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:shadow-[0_1px_1px_rgba(65,69,73,.3),0_1px_3px_1px_rgba(65,69,73,.15)]';

/** Chip de filtro (para desplegables que no usan FilterChip) */
export const FILTER_CHIP =
  'h-8 w-auto gap-1.5 rounded-lg px-3 text-xs font-medium shadow-none focus:ring-1 focus:ring-[#0b57d0] focus:ring-offset-0 bg-white dark:bg-card border border-[#747775] dark:border-border text-[#444746] dark:text-muted-foreground hover:bg-[#f0f4f9] dark:hover:bg-muted';

const ACTIVE_CHIP =
  'bg-[#c2e7ff] border-[#c2e7ff] text-[#001d35] hover:bg-[#b3dcf5] dark:bg-blue-900/50 dark:border-blue-900/50 dark:text-blue-100 pr-8 [&>svg:last-child]:hidden';

/**
 * Filtro estilo Google (Gmail/Drive): chip con borde fino que muestra el nombre del filtro.
 * Al elegir algo se pinta azul claro con ✓ y el valor, y trae una X para quitarlo.
 */
export function FilterChip({
  value, onValueChange, label, resetValue = 'all', disabled, children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  /** Nombre del filtro cuando no hay nada elegido (p. ej. "Dispatcher") */
  label: string;
  /** Valor "sin filtro"; la X vuelve a este valor */
  resetValue?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const active = value !== resetValue;
  const showLabel = !active && resetValue === 'all';
  return (
    <div className="relative inline-flex">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn(FILTER_CHIP, 'max-w-[260px] [&>span]:!flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:line-clamp-none', active && ACTIVE_CHIP)}>
          <span className="flex items-center gap-1.5 min-w-0">
            {active && <Check className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{showLabel ? label : <SelectValue placeholder={label} />}</span>
          </span>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {active && !disabled && (
        <button
          type="button"
          title="Quitar filtro"
          onClick={e => { e.stopPropagation(); onValueChange(resetValue); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-[#001d35] dark:text-blue-100 hover:bg-black/10"
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

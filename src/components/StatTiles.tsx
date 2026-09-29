import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatTile {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Fondo y color del ícono, p. ej. 'bg-sky-100 text-sky-700' */
  tint: string;
}

// Clases completas escritas a mano para que Tailwind las genere
const LG_COLS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

/** Fila de tarjetas de resumen arriba de cada página (estilo RouteOne) */
export function StatTiles({ tiles, className }: { tiles: StatTile[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-3', LG_COLS[tiles.length] ?? 'lg:grid-cols-6', className)}>
      {tiles.map(t => (
        <div key={t.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', t.tint)}>
            <t.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{t.label}</p>
            <p className="text-xl font-semibold leading-tight truncate">{t.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado en etiqueta de color sólido con texto blanco */
export function SolidStatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white', color)}>
      {label}
    </span>
  );
}

/** Clases compartidas: buscador/filtros en píldora y contenedor de tabla */
export const PILL_INPUT = 'h-10 rounded-full bg-card shadow-sm';
export const TABLE_CARD = 'rounded-xl border bg-card shadow-sm overflow-hidden';
export const TABLE_HEAD_ROW = 'border-b bg-muted/50';
export const TABLE_ROW = 'border-b transition-colors hover:bg-muted/40';

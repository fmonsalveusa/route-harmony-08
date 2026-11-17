import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatTile {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Fondo y color del ícono, p. ej. 'bg-sky-100 text-sky-700' */
  tint: string;
  /** Línea chica debajo del número, p. ej. "12 payments" */
  hint?: string;
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
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2.5', LG_COLS[tiles.length] ?? 'lg:grid-cols-6', className)}>
      {tiles.map(t => (
        <div key={t.label} className="stat-tile-3d flex items-center gap-3 rounded-2xl border border-[#e3e3e3] dark:border-border bg-white dark:bg-card px-4 py-2.5" title={t.hint}>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', t.tint)}>
            <t.icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground truncate">{t.value}</p>
            <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground truncate">{t.label}</p>
            {t.hint && <p className="text-[11px] text-[#444746]/80 dark:text-muted-foreground truncate">{t.hint}</p>}
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
export const PILL_INPUT = 'h-10 rounded-full bg-white dark:bg-card border-[#e3e3e3] dark:border-border shadow-none';
export const TABLE_CARD = 'rounded-3xl border border-[#e3e3e3] dark:border-border bg-white dark:bg-card overflow-hidden';
export const TABLE_HEAD_ROW = 'border-b border-[#e3e3e3] dark:border-border bg-[#f8fafd] dark:bg-muted/30';
export const TABLE_ROW = 'border-b border-[#f0f0f0] dark:border-border transition-colors hover:bg-[#f8fafd] dark:hover:bg-muted/30';

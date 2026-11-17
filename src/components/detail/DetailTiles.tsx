import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Copy, Check } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

/** Piezas compartidas del detalle de camiones y drivers (estilo Google) */
export const DETAIL_CARD = 'rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4 space-y-3';
export const DETAIL_TITLE = 'text-[15px] font-medium uppercase tracking-wide text-[#1f1f1f] dark:text-foreground';

// Colores tonales de los íconos (estilo Google)
export const TONE = {
  blue: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200',
  green: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200',
  amber: 'bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200',
  red: 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200',
  violet: 'bg-[#e9ddff] text-[#22005d] dark:bg-violet-900/40 dark:text-violet-200',
  sky: 'bg-[#c2e7ff] text-[#001d35] dark:bg-sky-900/40 dark:text-sky-200',
  gray: 'bg-[#e3e3e3] text-[#1f1f1f] dark:bg-muted dark:text-foreground',
};

/** Dato en mini-tarjeta con ícono; con `copy` muestra un botón para copiar al pasar el mouse */
export function Tile({ icon: Icon, tone = 'blue', label, value, copy }: {
  icon: LucideIcon; tone?: keyof typeof TONE; label: string; value: React.ReactNode; copy?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const doCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!copy) return;
    navigator.clipboard.writeText(copy).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div className="group relative flex items-center gap-2.5 rounded-2xl bg-[#f8fafd] dark:bg-muted/40 px-3 py-2 min-w-0">
      <span className={cn('h-8 w-8 shrink-0 rounded-full flex items-center justify-center', TONE[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] uppercase tracking-wide text-[#444746] dark:text-muted-foreground truncate">{label}</p>
        <div className="text-sm text-[#1f1f1f] dark:text-foreground [overflow-wrap:anywhere] leading-5">{value}</div>
      </div>
      {copy && (
        <button
          type="button"
          onClick={doCopy}
          title="Copiar"
          className={cn('shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-opacity hover:bg-[#e8f0fe] dark:hover:bg-muted',
            copied ? 'opacity-100 text-[#188038]' : 'opacity-0 group-hover:opacity-100 text-[#0b57d0] dark:text-blue-300')}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

/** Días hasta una fecha YYYY-MM-DD (negativo = vencido) */
export const daysUntil = (date: string | null | undefined) => {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

/** Vencimiento con anillo de progreso (verde / amarillo / rojo) y cuenta regresiva */
export function ExpiryRing({ icon: Icon, label, date }: { icon: LucideIcon; label: string; date: string | null | undefined }) {
  const days = daysUntil(date);
  const expired = days !== null && days < 0;
  const color = days === null ? '#c4c7c5' : days < 0 ? '#d93025' : days <= 30 ? '#d93025' : days <= 60 ? '#f9ab00' : '#188038';
  const pct = days === null ? 0 : Math.max(0, Math.min(1, days / 365));
  const R = 17, C = 2 * Math.PI * R;
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl px-3 py-2', expired ? 'bg-[#d93025] text-white' : 'bg-[#f8fafd] dark:bg-muted/40')}>
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
          <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3.5" className={expired ? 'stroke-white/30' : 'stroke-[#e3e3e3] dark:stroke-border'} />
          {!expired && days !== null && (
            <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3.5" strokeLinecap="round" stroke={color}
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          )}
        </svg>
        <Icon className={cn('absolute inset-0 m-auto h-4 w-4', expired ? 'text-white' : 'text-[#444746] dark:text-muted-foreground')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[10.5px] uppercase tracking-wide truncate', expired ? 'text-white/85' : 'text-[#444746] dark:text-muted-foreground')}>{label}</p>
        {days === null ? (
          <p className="text-sm text-[#444746] dark:text-muted-foreground">Sin fecha</p>
        ) : expired ? (
          <p className="text-sm font-bold tracking-wide">VENCIDO · hace {Math.abs(days)} {Math.abs(days) === 1 ? 'día' : 'días'}</p>
        ) : (
          <p className="text-sm text-[#1f1f1f] dark:text-foreground">
            <span className="font-medium" style={{ color }}>{days === 0 ? 'Vence hoy' : `Vence en ${days} ${days === 1 ? 'día' : 'días'}`}</span>
          </p>
        )}
        {date && <p className={cn('text-[11px]', expired ? 'text-white/85' : 'text-[#444746] dark:text-muted-foreground')}>{formatDate(date)}</p>}
      </div>
    </div>
  );
}

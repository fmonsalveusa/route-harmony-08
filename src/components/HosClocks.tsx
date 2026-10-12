import { cn } from '@/lib/utils';

export interface HosClockRow {
  driver_id: string;
  source: string;
  duty_status: string | null;
  status_since: string | null;
  until_break_min: number | null;
  driving_min: number | null;
  shift_min: number | null;
  cycle_min: number | null;
  cycle_limit_min: number | null;
  computed: boolean;
  updated_at: string;
}

const DUTY: Record<string, { label: string; cls: string }> = {
  driving: { label: 'Driving', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  on_duty: { label: 'On Duty', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  off_duty: { label: 'Off Duty', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  sleeper: { label: 'Sleeper', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  personal_conveyance: { label: 'Personal Conv.', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  yard_move: { label: 'Yard Move', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Anillo: verde con margen, amarillo con poco, rojo casi agotado */
function Ring({ label, minutes, limit }: { label: string; minutes: number | null; limit: number }) {
  const left = Math.max(0, minutes ?? 0);
  const pct = minutes == null ? 0 : Math.min(1, left / limit);
  const color = minutes == null ? 'stroke-muted' : pct > 0.25 ? 'stroke-emerald-500' : pct > 0.1 ? 'stroke-amber-500' : 'stroke-red-500';
  const r = 17, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative h-11 w-11">
        <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
          <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={color}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
          {minutes == null ? '—' : hhmm(left)}
        </span>
      </div>
      <span className="text-[9px] font-medium text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
};

/** Relojes HOS del ELD (HOS247 / RouteOne) en la card del driver */
export function HosClocks({ row, className }: { row: HosClockRow; className?: string }) {
  const duty = row.duty_status ? DUTY[row.duty_status] : null;
  return (
    <div className={cn('rounded-lg border bg-muted/30 px-2.5 py-2', className)}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">HOS Clocks</span>
        <div className="flex items-center gap-1.5">
          {duty && <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', duty.cls)}>{duty.label}</span>}
          <span className="text-[9px] text-muted-foreground" title={`${row.source}${row.computed ? ' · calculado con los eventos del ELD' : ''}`}>
            {row.source} · {ago(row.updated_at)}
          </span>
        </div>
      </div>
      <div className="flex justify-between">
        <Ring label="Until Break" minutes={row.until_break_min} limit={480} />
        <Ring label="Driving" minutes={row.driving_min} limit={660} />
        <Ring label="Shift" minutes={row.shift_min} limit={840} />
        <Ring label="Cycle" minutes={row.cycle_min} limit={row.cycle_limit_min || 4200} />
      </div>
    </div>
  );
}

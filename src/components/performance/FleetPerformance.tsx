import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Truck, DollarSign, Gauge, Route, CalendarX2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { todayET } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

/**
 * Rendimiento por camión, solo con datos que el sistema ya registra (sin gastos):
 * facturado, $/milla (con millas vacías), millas cargadas vs vacías y días parado sin carga.
 * Semana lunes–domingo; se compara con la semana anterior.
 */

type Kind = 'all' | 'owner_operator' | 'company_driver';
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

interface Row {
  truckId: string;
  unit: string;
  driver: string;
  kind: string;
  loads: number;
  revenue: number;
  prevRevenue: number;
  miles: number;
  empty: number;
  rpm: number | null;
  idleDays: number;
  daysCounted: number;
}

export function FleetPerformance() {
  const navigate = useNavigate();
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const [weekOffset, setWeekOffset] = useState(0);
  const [kind, setKind] = useState<Kind>('all');

  const today = todayET();
  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(today + 'T12:00:00'), { weekStartsOn: 1 }), weekOffset), [today, weekOffset]);
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addWeeks(weekStart, -1);

  const rows = useMemo<Row[]>(() => {
    const ws = ymd(weekStart), we = ymd(weekEnd), ps = ymd(prevStart), pe = ymd(addDays(prevStart, 6));
    // Días de la semana que ya pasaron (hasta hoy): los futuros no cuentan como "parado"
    const days: string[] = [];
    for (let i = 0; i < 7; i++) { const d = ymd(addDays(weekStart, i)); if (d <= today) days.push(d); }

    const active = drivers.filter(d => d.status !== 'inactive' && d.truck_id && ['owner_operator', 'company_driver'].includes(String(d.service_type)));
    const valid = loads.filter(l => !['cancelled'].includes(l.status));
    const truckOf = (l: any) => l.truck_id || active.find(d => d.id === l.driver_id)?.truck_id || null;

    const out: Row[] = [];
    for (const d of active) {
      if (kind !== 'all' && d.service_type !== kind) continue;
      const truck = trucks.find(t => String(t.id) === String(d.truck_id));
      if (!truck || (truck as any).status === 'inactive') continue;
      if (out.some(r => r.truckId === String(truck.id))) continue;
      const mine = valid.filter(l => String(truckOf(l)) === String(truck.id));
      const dateOf = (l: any) => (l.delivery_date || l.pickup_date || '').slice(0, 10);
      const wk = mine.filter(l => { const x = dateOf(l); return x >= ws && x <= we; });
      const pw = mine.filter(l => { const x = dateOf(l); return x >= ps && x <= pe; });
      const revenue = wk.reduce((s, l) => s + Number(l.total_rate || 0), 0);
      const miles = wk.reduce((s, l) => s + Number(l.miles || 0), 0);
      const empty = wk.reduce((s, l) => s + Number((l as any).empty_miles || 0), 0);
      // Día cubierto = está dentro de alguna carga (pickup → delivery), de cualquier semana
      const covered = (day: string) => mine.some(l => {
        const p = (l.pickup_date || '').slice(0, 10), del = (l.delivery_date || l.pickup_date || '').slice(0, 10);
        return p && p <= day && day <= del;
      });
      out.push({
        truckId: String(truck.id),
        unit: String((truck as any).unit_number ?? '—'),
        driver: d.name,
        kind: String(d.service_type),
        loads: wk.length,
        revenue,
        prevRevenue: pw.reduce((s, l) => s + Number(l.total_rate || 0), 0),
        miles, empty,
        rpm: miles + empty > 0 ? revenue / (miles + empty) : null,
        idleDays: days.filter(x => !covered(x)).length,
        daysCounted: days.length,
      });
    }
    return out.sort((a, b) => b.revenue - a.revenue);
  }, [loads, drivers, trucks, weekStart, weekEnd, prevStart, kind, today]);

  const tot = rows.reduce((a, r) => ({
    revenue: a.revenue + r.revenue, miles: a.miles + r.miles, empty: a.empty + r.empty, idle: a.idle + r.idleDays, prev: a.prev + r.prevRevenue,
  }), { revenue: 0, miles: 0, empty: 0, idle: 0, prev: 0 });
  const totRpm = tot.miles + tot.empty > 0 ? tot.revenue / (tot.miles + tot.empty) : null;
  const emptyPct = (m: number, e: number) => (m + e > 0 ? (e / (m + e)) * 100 : 0);

  const trend = (now: number, before: number) => {
    if (before === 0 && now === 0) return <Minus className="h-3.5 w-3.5 text-[#9aa0a6]" />;
    if (now >= before) return <span className="inline-flex items-center text-[#188038]"><ArrowUp className="h-3.5 w-3.5" />{before > 0 ? `${Math.round(((now - before) / before) * 100)}%` : ''}</span>;
    return <span className="inline-flex items-center text-[#d93025]"><ArrowDown className="h-3.5 w-3.5" />{before > 0 ? `${Math.round(((before - now) / before) * 100)}%` : ''}</span>;
  };
  const rpmColor = (v: number | null) => v == null ? 'text-[#9aa0a6]' : v >= 1.9 ? 'text-[#188038]' : v >= 1.6 ? 'text-[#b06000]' : 'text-[#d93025]';

  const tiles = [
    { label: 'Facturado', value: money(tot.revenue), sub: <>vs semana anterior {trend(tot.revenue, tot.prev)}</>, icon: DollarSign, tint: 'bg-[#c4eed0] text-[#072711]' },
    { label: '$/milla (con vacías)', value: totRpm != null ? `$${totRpm.toFixed(2)}` : '—', sub: `${Math.round(tot.miles + tot.empty).toLocaleString()} millas`, icon: Gauge, tint: 'bg-[#d3e3fd] text-[#041e49]' },
    { label: 'Millas vacías', value: `${emptyPct(tot.miles, tot.empty).toFixed(0)}%`, sub: `${Math.round(tot.empty).toLocaleString()} de ${Math.round(tot.miles + tot.empty).toLocaleString()}`, icon: Route, tint: 'bg-[#fef7e0] text-[#8a5a00]' },
    { label: 'Días parados', value: String(tot.idle), sub: 'suma de todos los camiones', icon: CalendarX2, tint: 'bg-[#f9dedc] text-[#410e0b]' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full bg-[#f0f4f9] dark:bg-muted/60 p-1">
          <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-card" onClick={() => setWeekOffset(w => w - 1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-3 text-sm font-medium text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
            {weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : 'Semana'} · {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </span>
          <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-card disabled:opacity-40" onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset >= 0} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {([['all', 'Todos'], ['owner_operator', 'Owner Operators'], ['company_driver', 'Company Drivers']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)}
            className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors', kind === k ? 'bg-[#d3e3fd] text-[#041e49]' : 'border border-[#c4c7c5] text-[#444746] dark:text-muted-foreground')}>
            {l}
          </button>
        ))}
        <span className="inline-flex items-center gap-1.5 h-9 rounded-full bg-[#f0f4f9] dark:bg-muted/60 px-3 text-xs font-medium text-[#444746] dark:text-muted-foreground">
          <Truck className="h-3.5 w-3.5" /> {rows.length} camiones
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="stat-tile-3d rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-5 py-4 flex items-start gap-3">
            <span className={cn('h-11 w-11 shrink-0 rounded-full flex items-center justify-center', t.tint)}><t.icon className="h-5 w-5" /></span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium text-[#444746] dark:text-muted-foreground">{t.label}</p>
              <p className="text-[26px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">{t.value}</p>
              <p className="text-xs text-[#444746] dark:text-muted-foreground flex items-center gap-1">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#444746] dark:text-muted-foreground border-b border-[#e3e3e3] dark:border-border">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-2 py-3 font-medium">Camión / Driver</th>
                <th className="px-2 py-3 font-medium text-right">Cargas</th>
                <th className="px-2 py-3 font-medium text-right">Facturado</th>
                <th className="px-2 py-3 font-medium text-right">$/milla</th>
                <th className="px-2 py-3 font-medium text-right">Millas cargadas</th>
                <th className="px-2 py-3 font-medium text-right">Vacías</th>
                <th className="px-4 py-3 font-medium text-right">Días parado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const ep = emptyPct(r.miles, r.empty);
                return (
                  <tr key={r.truckId} className="border-b border-[#f0f0f0] dark:border-border last:border-0 hover:bg-[#f8fafd] dark:hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/loads?q=${encodeURIComponent(r.driver)}`)} title="Ver sus cargas">
                    <td className="px-4 py-2.5 text-[#444746]">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-[#1f1f1f] dark:text-foreground">Unit {r.unit}</div>
                      <div className="text-xs text-[#444746] dark:text-muted-foreground">{r.driver} · {r.kind === 'company_driver' ? 'Company' : 'OO'}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right">{r.loads}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="font-medium">{money(r.revenue)}</div>
                      <div className="text-xs flex justify-end">{trend(r.revenue, r.prevRevenue)}</div>
                    </td>
                    <td className={cn('px-2 py-2.5 text-right font-medium', rpmColor(r.rpm))}>{r.rpm != null ? `$${r.rpm.toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-2.5 text-right">{Math.round(r.miles).toLocaleString()}</td>
                    <td className={cn('px-2 py-2.5 text-right', ep >= 25 ? 'text-[#d93025] font-medium' : ep >= 15 ? 'text-[#b06000]' : '')}>
                      {Math.round(r.empty).toLocaleString()} <span className="text-xs">({ep.toFixed(0)}%)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        r.idleDays === 0 ? 'bg-[#e6f4ea] text-[#137333]' : r.idleDays >= 3 ? 'bg-[#d93025] text-white' : 'bg-[#fef7e0] text-[#8a5a00]')}>
                        {r.idleDays}/{r.daysCounted}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#444746]">No hay camiones activos con driver asignado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-[#444746] dark:text-muted-foreground px-1">
        Cargas de la semana por fecha de entrega. $/milla = facturado ÷ (millas cargadas + vacías). Día parado = día ya transcurrido sin ninguna carga entre su pickup y su entrega. Sin Dispatch Service.
      </p>
    </div>
  );
}

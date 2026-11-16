import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DbDispatcher } from '@/hooks/useDispatchers';
import type { DbDriver } from '@/hooks/useDrivers';
import { Loader2, Package, DollarSign, Users } from 'lucide-react';

const TZ = 'America/New_York';
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Semana actual (lunes a domingo, hora del Este) */
function currentWeek() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = today.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const label = (x: Date) => `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
  return { start: iso(start), end: iso(end), label: `${label(start)} – ${label(end)}` };
}

const GROUPS = [
  { key: 'owner_operator', label: 'Owner Operators', tone: 'bg-[#ffdcc1] text-[#2f1500] dark:bg-orange-900/40 dark:text-orange-200' },
  { key: 'dispatch_service', label: 'Dispatch Service', tone: 'bg-[#c2e7ff] text-[#001d35] dark:bg-sky-900/40 dark:text-sky-200' },
  { key: 'company_driver', label: 'Company Drivers', tone: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
] as const;

interface WeekLoad {
  id: string;
  driver_id: string | null;
  total_rate: number;
  dispatcher_pay_amount: number | null;
  service_type: string | null;
  created_at: string;
}

/**
 * Detalle del dispatcher: sus drivers y, en la semana actual, las cargas y la comisión por driver,
 * separadas en Owner Operators, Dispatch Service y Company Drivers.
 * Igual que el pago de comisión: la carga cuenta en la semana en que se CREÓ, con la comisión guardada en la carga.
 */
export function DispatcherDetailPanel({ dispatcher, drivers }: { dispatcher: DbDispatcher; drivers: DbDriver[] }) {
  const week = useMemo(currentWeek, []);

  const { data: loads = [], isLoading } = useQuery({
    queryKey: ['dispatcher_week_loads', dispatcher.id, week.start],
    queryFn: async () => {
      // Un día de margen a cada lado por la diferencia UTC/Este; luego se filtra exacto en hora del Este
      const from = new Date(`${week.start}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 1);
      const to = new Date(`${week.end}T00:00:00Z`); to.setUTCDate(to.getUTCDate() + 2);
      const { data, error } = await supabase.from('loads')
        .select('id, driver_id, total_rate, dispatcher_pay_amount, service_type, created_at')
        .eq('dispatcher_id', dispatcher.id).neq('status', 'cancelled')
        .gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
      if (error) throw error;
      return ((data as WeekLoad[]) ?? []).filter(l => {
        const d = new Date(l.created_at).toLocaleDateString('en-CA', { timeZone: TZ });
        return d >= week.start && d <= week.end;
      });
    },
  });

  const myDrivers = drivers.filter(d => d.dispatcher_id === dispatcher.id && d.status !== 'inactive');

  const rows = useMemo(() => {
    const byDriver: Record<string, { loads: number; revenue: number; commission: number; service: string }> = {};
    for (const l of loads) {
      const driver = drivers.find(d => d.id === l.driver_id);
      const service = l.service_type || driver?.service_type || 'owner_operator';
      const pct = service === 'dispatch_service' ? dispatcher.dispatch_service_percentage : dispatcher.commission_percentage;
      const stored = Number(l.dispatcher_pay_amount) || 0;
      const commission = stored > 0 ? stored : Number(l.total_rate) * ((pct || 0) / 100);
      const key = `${l.driver_id ?? 'none'}|${service}`;
      byDriver[key] ??= { loads: 0, revenue: 0, commission: 0, service };
      byDriver[key].loads += 1;
      byDriver[key].revenue += Number(l.total_rate) || 0;
      byDriver[key].commission += commission;
    }
    // Drivers sin cargas esta semana también aparecen, en cero
    for (const d of myDrivers) {
      const key = `${d.id}|${d.service_type || 'owner_operator'}`;
      if (!Object.keys(byDriver).some(k => k.startsWith(`${d.id}|`))) byDriver[key] = { loads: 0, revenue: 0, commission: 0, service: d.service_type || 'owner_operator' };
    }
    return Object.entries(byDriver).map(([key, v]) => {
      const id = key.split('|')[0];
      return { id, name: drivers.find(d => d.id === id)?.name || 'Sin driver', ...v };
    });
  }, [loads, drivers, myDrivers, dispatcher]);

  const totals = rows.reduce((t, r) => ({ loads: t.loads + r.loads, revenue: t.revenue + r.revenue, commission: t.commission + r.commission }), { loads: 0, revenue: 0, commission: 0 });

  return (
    <div className="px-4 py-3 bg-[#f8fafd] dark:bg-background/60 border-t border-[#e3e3e3] dark:border-border animate-fade-in space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground mr-2">Semana actual <span className="text-sm font-normal text-[#444746] dark:text-muted-foreground">· {week.label}</span></p>
        {[
          { icon: Users, label: 'Drivers', value: String(myDrivers.length), tone: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
          { icon: Package, label: 'Cargas', value: String(totals.loads), tone: 'bg-[#e3e3e3] text-[#1f1f1f] dark:bg-muted dark:text-foreground' },
          { icon: DollarSign, label: 'Total cargas', value: money(totals.revenue), tone: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
          { icon: DollarSign, label: 'Comisión total', value: money(totals.commission), tone: 'bg-[#f3e8fd] text-[#4a148c] dark:bg-violet-900/40 dark:text-violet-200' },
        ].map(c => (
          <span key={c.label} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium', c.tone)}>
            <c.icon className="h-3.5 w-3.5" /> {c.label}: <span className="font-semibold">{c.value}</span>
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#444746]" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {GROUPS.map(g => {
            const list = rows.filter(r => r.service === g.key).sort((a, b) => b.commission - a.commission || a.name.localeCompare(b.name));
            const sub = list.reduce((t, r) => ({ loads: t.loads + r.loads, revenue: t.revenue + r.revenue, commission: t.commission + r.commission }), { loads: 0, revenue: 0, commission: 0 });
            return (
              <div key={g.key} className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
                  <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', g.tone)}>{g.label}</span>
                  <span className="text-xs text-[#444746] dark:text-muted-foreground">{list.length} {list.length === 1 ? 'driver' : 'drivers'}</span>
                </div>
                {list.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-[#444746] dark:text-muted-foreground">Sin drivers en esta categoría.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[#444746] dark:text-muted-foreground border-b border-[#f0f0f0] dark:border-border">
                        <th className="text-left font-medium px-4 py-1.5">Driver</th>
                        <th className="text-right font-medium px-2 py-1.5">Cargas</th>
                        <th className="text-right font-medium px-2 py-1.5">Total</th>
                        <th className="text-right font-medium px-4 py-1.5">Comisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(r => (
                        <tr key={`${r.id}-${r.service}`} className="border-b border-[#f0f0f0] dark:border-border last:border-b-0">
                          <td className="px-4 py-1.5 font-medium text-[#1f1f1f] dark:text-foreground truncate max-w-[160px]" title={r.name}>{r.name}</td>
                          <td className="px-2 py-1.5 text-right text-[#444746] dark:text-muted-foreground">{r.loads}</td>
                          <td className="px-2 py-1.5 text-right text-[#444746] dark:text-muted-foreground whitespace-nowrap">{money(r.revenue)}</td>
                          <td className="px-4 py-1.5 text-right font-medium text-[#188038] dark:text-emerald-400 whitespace-nowrap">{money(r.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#f8fafd] dark:bg-muted/30 text-xs font-medium">
                        <td className="px-4 py-2 text-[#444746] dark:text-muted-foreground">Subtotal</td>
                        <td className="px-2 py-2 text-right">{sub.loads}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{money(sub.revenue)}</td>
                        <td className="px-4 py-2 text-right text-[#188038] dark:text-emerald-400 whitespace-nowrap">{money(sub.commission)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

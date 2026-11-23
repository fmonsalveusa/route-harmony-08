import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpFromLine, ArrowDownToLine, UserX, AlertTriangle, Landmark, ChevronDown, ChevronRight, CalendarCheck, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DetentionStop, fmtDuration, loadDetention } from '@/lib/detention';
import { todayET } from '@/lib/dateUtils';
import { getLoadAlerts } from '@/lib/loadAlerts';
import type { DbLoad } from '@/hooks/useLoads';

interface DriverLite { id: string; name: string; status: string; is_paused?: boolean | null }

const FINISHED = ['delivered', 'tonu', 'cancelled', 'paid'];
const BEFORE_PICKUP = ['planned', 'dispatched', 'in_transit', 'on_site_pickup'];

interface Row {
  key: string;
  icon: typeof AlertTriangle;
  tint: string;
  label: string;
  items: { id: string; title: string; sub: string; href: string }[];
  emptyText: string;
}

/** Resumen de lo que hay que atender hoy, con acceso directo a cada carga o driver */
export const TodaySummaryCard = ({ loads, drivers }: { loads: DbLoad[]; drivers: DriverLite[] }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);

  // Detention por cobrar: paradas terminadas en los últimos 30 días con espera > 2 h, sin reclamo enviado
  const [detStops, setDetStops] = useState<(DetentionStop & { load_id: string })[]>([]);
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    supabase.from('load_stops')
      .select('id, load_id, stop_type, stop_order, address, date, time, arrived_at, departed_at' as any)
      .not('arrived_at' as any, 'is', null).not('departed_at' as any, 'is', null).gte('arrived_at' as any, since)
      .then(({ data }) => setDetStops(((data as any[]) || []) as any));
  }, []);

  const rows = useMemo<Row[]>(() => {
    const today = todayET();
    const name = (id: string | null) => drivers.find(d => d.id === id)?.name || 'Sin driver';
    const loadItem = (l: DbLoad, sub: string) => ({
      id: l.id, title: `#${l.reference_number} · ${name(l.driver_id)}`, sub, href: `/loads?openLoad=${l.id}`,
    });
    const active = loads.filter(l => !FINISHED.includes(l.status));
    const busy = new Set(active.filter(l => l.status !== 'planned').map(l => l.driver_id));

    return [
      {
        key: 'pickups', icon: ArrowUpFromLine, tint: 'bg-[#e6f4ea] text-[#137333]', label: 'Pickups pendientes hoy',
        items: active.filter(l => l.pickup_date === today && BEFORE_PICKUP.includes(l.status))
          .map(l => loadItem(l, `${l.origin}${l.pickup_time ? ` · ${l.pickup_time}` : ''}`)),
        emptyText: 'No quedan pickups para hoy',
      },
      {
        key: 'deliveries', icon: ArrowDownToLine, tint: 'bg-[#fce8e6] text-[#c5221f]', label: 'Entregas pendientes hoy',
        items: active.filter(l => l.delivery_date === today)
          .map(l => loadItem(l, `${l.destination}${l.delivery_time ? ` · ${l.delivery_time}` : ''}`)),
        emptyText: 'No quedan entregas para hoy',
      },
      {
        key: 'alerts', icon: AlertTriangle, tint: 'bg-[#feefc3] text-[#7a4f01]', label: 'Cargas con alertas',
        items: active.map(l => ({ l, a: getLoadAlerts(l) })).filter(x => x.a.length > 0)
          .map(({ l, a }) => loadItem(l, a.map(x => x.label).join(' · '))),
        emptyText: 'Ninguna carga con datos raros',
      },
      {
        key: 'idle', icon: UserX, tint: 'bg-[#f0f4f9] text-[#444746]', label: 'Drivers sin carga',
        items: drivers.filter(d => d.status === 'available' && !d.is_paused && !busy.has(d.id))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(d => ({ id: d.id, title: d.name, sub: 'Sin carga activa', href: '/tracking' })),
        emptyText: 'Todos los drivers tienen carga',
      },
      {
        key: 'detention', icon: Timer, tint: 'bg-[#fce8e6] text-[#c5221f]', label: 'Detention por cobrar',
        items: loads
          .filter(l => !(l as any).detention_claimed_at && detStops.some(s => s.load_id === l.id))
          .map(l => ({ l, d: loadDetention(detStops.filter(s => s.load_id === l.id), (l as any).detention_rate) }))
          .filter(x => x.d.billableMin > 0)
          .map(({ l, d }) => loadItem(l, `${fmtDuration(d.billableMin)} cobrable · $${d.amount.toFixed(2)} · ${l.broker_client || ''}`)),
        emptyText: 'Nada de detention pendiente por reclamar',
      },
      {
        key: 'factoring', icon: Landmark, tint: 'bg-[#d3e3fd] text-[#041e49]', label: 'Listas para factoring',
        items: loads.filter(l => l.status === 'delivered' && l.factoring === 'pending')
          .map(l => loadItem(l, `$${Number(l.total_rate || 0).toLocaleString()} · ${l.broker_client || ''}`)),
        emptyText: 'Nada pendiente de factoring',
      },
    ];
  }, [loads, drivers, detStops]);

  return (
    <div className="rounded-2xl border border-[#e3e3e3] dark:border-border bg-white dark:bg-card shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <CalendarCheck className="h-4 w-4 text-[#0b57d0]" />
        <h2 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Hoy</h2>
        <span className="text-xs text-[#444746] dark:text-muted-foreground">
          {new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
      <div className="divide-y divide-[#f0f0f0] dark:divide-border">
        {rows.map(row => {
          const Icon = row.icon;
          const isOpen = open === row.key;
          return (
            <div key={row.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : row.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f8fafd] dark:hover:bg-muted/30 transition-colors"
              >
                <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${row.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm text-[#1f1f1f] dark:text-foreground">{row.label}</span>
                <span className={`min-w-[28px] text-center rounded-full px-2 py-0.5 text-sm font-semibold ${row.items.length ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] text-[#444746] dark:bg-muted'}`}>
                  {row.items.length}
                </span>
                {isOpen ? <ChevronDown className="h-4 w-4 text-[#444746]" /> : <ChevronRight className="h-4 w-4 text-[#444746]" />}
              </button>
              {isOpen && (
                <div className="pb-2 pl-[60px] pr-4">
                  {row.items.length === 0 ? (
                    <p className="py-1.5 text-xs text-[#444746] dark:text-muted-foreground">{row.emptyText}</p>
                  ) : (
                    <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                      {row.items.map(it => (
                        <li key={it.id}>
                          <button
                            type="button"
                            onClick={() => navigate(it.href)}
                            className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-[#f0f4f9] dark:hover:bg-muted/50 transition-colors"
                          >
                            <p className="text-[13px] font-medium text-[#0b57d0] dark:text-blue-300">{it.title}</p>
                            <p className="text-[11px] text-[#444746] dark:text-muted-foreground truncate">{it.sub}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

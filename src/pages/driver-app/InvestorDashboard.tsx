import { useMemo, useState } from 'react';
import { useDriverPayments, DriverPayment } from '@/hooks/useDriverPayments';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet } from 'lucide-react';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { CARD } from '@/components/driver-app/driverUi';
import { format, parseISO, startOfWeek, addWeeks } from 'date-fns';

const usd = (n: number, dec = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const net = (p: DriverPayment) => Number(p.net_amount ?? p.amount) || 0;
const toDate = (d: string) => parseISO(d.length === 10 ? `${d}T12:00:00` : d);

function shortLocation(address?: string): string {
  if (!address) return '—';
  const parts = address.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 1; i--) {
    const m = parts[i].match(/\b([A-Z]{2})\b/);
    if (m) return `${parts[i - 1] || parts[0]}, ${m[1]}`;
  }
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
}

/** Gráfico de barras de las últimas 8 semanas (pagado + pendiente apilado) */
function WeeklyChart({ payments }: { payments: DriverPayment[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const weeks = useMemo(() => {
    const cur = startOfWeek(new Date(), { weekStartsOn: 1 });
    const list = Array.from({ length: 8 }, (_, i) => ({ start: addWeeks(cur, i - 7), paid: 0, pending: 0 }));
    for (const p of payments) {
      const d = startOfWeek(toDate(p.payment_date || p.created_at), { weekStartsOn: 1 }).getTime();
      const w = list.find(x => x.start.getTime() === d);
      if (!w) continue;
      if (p.status === 'paid') w.paid += net(p); else w.pending += net(p);
    }
    return list;
  }, [payments]);
  const max = Math.max(...weeks.map(w => w.paid + w.pending), 1);
  const shown = weeks[sel ?? weeks.length - 1];

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-[#444746]">Week of {format(shown.start, 'MMM d')}</p>
        <p className="text-lg font-medium">{usd(shown.paid + shown.pending)}</p>
      </div>
      <div className="flex items-end gap-2 h-36 mt-4">
        {weeks.map((w, i) => {
          const total = w.paid + w.pending;
          const active = (sel ?? weeks.length - 1) === i;
          return (
            <button key={i} type="button" onClick={() => setSel(i)} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
              <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: `${Math.max((total / max) * 100, total > 0 ? 4 : 2)}%` }}>
                {total === 0 ? (
                  <div className="w-full h-full bg-[#e9eef6]" />
                ) : (
                  <>
                    <div className={active ? 'bg-[#f9ab00]' : 'bg-[#fde293]'} style={{ height: `${(w.pending / total) * 100}%` }} />
                    <div className={active ? 'bg-[#0b57d0]' : 'bg-[#a8c7fa]'} style={{ height: `${(w.paid / total) * 100}%` }} />
                  </>
                )}
              </div>
              <span className={`text-[10px] ${active ? 'font-semibold text-[#1f1f1f]' : 'text-[#747775]'}`}>{format(w.start, 'M/d')}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-[#444746] mt-3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0b57d0]" /> Paid {usd(shown.paid, 0)}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f9ab00]" /> Pending {usd(shown.pending, 0)}</span>
      </div>
    </div>
  );
}

export default function InvestorDashboard() {
  const { profile } = useAuth();
  const { investorPayments, loading, investorTotalPending, investorTotalPaid, refetch } = useDriverPayments();

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;
  }

  const recent = investorPayments.slice(0, 8);

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="px-4 pt-2 space-y-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <h1 className="text-[28px] leading-9 font-normal">Hi, {profile?.full_name?.split(' ')[0]}</h1>

        {/* Resumen de ganancias */}
        <div className="rounded-[28px] bg-[#d3e3fd] text-[#041e49] p-5">
          <p className="text-sm">Total earnings</p>
          <p className="text-[40px] leading-[48px] font-normal tracking-tight">{usd(investorTotalPaid + investorTotalPending)}</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs text-[#444746]">Paid</p>
              <p className="text-base font-medium text-[#0d652d]">{usd(investorTotalPaid)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs text-[#444746]">Pending</p>
              <p className="text-base font-medium text-[#8a5a00]">{usd(investorTotalPending)}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">Last 8 weeks</h2>
          <WeeklyChart payments={investorPayments} />
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">Recent payments</h2>
          {recent.length === 0 ? (
            <div className={`${CARD} p-8 text-center`}>
              <span className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#e9eef6] flex items-center justify-center"><Wallet className="h-7 w-7 text-[#444746]" /></span>
              <p className="text-sm text-[#444746]">No investor payments yet</p>
            </div>
          ) : (
            <div className={`${CARD} overflow-hidden divide-y divide-[#f0f4f9]`}>
              {recent.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{shortLocation(p.origin)} → {shortLocation(p.destination)}</p>
                    <p className="text-xs text-[#444746] truncate">#{p.load_reference}{(p.driver_name || p.recipient_name) ? ` · ${p.driver_name || p.recipient_name}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-medium">{usd(net(p))}</p>
                    <span className={`px-2 h-5 inline-flex items-center rounded-full text-[10px] font-medium ${p.status === 'paid' ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#fef7e0] text-[#8a5a00]'}`}>
                      {p.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

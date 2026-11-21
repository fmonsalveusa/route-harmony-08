import { useState } from 'react';
import { useDriverPayments, DriverPayment } from '@/hooks/useDriverPayments';
import { Check, Wallet } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { CARD } from '@/components/driver-app/driverUi';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

function shortLocation(address: string): string {
  if (!address) return '—';
  const parts = address.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = parts[i].match(/\b([A-Z]{2})\b/);
    if (match) {
      const city = parts[i - 1] || parts[0];
      return `${city}, ${match[1]}`;
    }
  }
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const net = (p: DriverPayment) => Number(p.net_amount ?? p.amount) || 0;
// Fechas "YYYY-MM-DD" se leen a mediodía para no correrse un día por zona horaria
const toDate = (d: string) => parseISO(d.length === 10 ? `${d}T12:00:00` : d);
const weekStart = (d: string) => startOfWeek(toDate(d), { weekStartsOn: 1 });

function Summary({ payments }: { payments: DriverPayment[] }) {
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
  const paidWeek = payments.filter(p => p.status === 'paid' && p.payment_date && weekStart(p.payment_date).getTime() === thisWeek).reduce((s, p) => s + net(p), 0);
  const pending = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + net(p), 0);
  const paidAll = payments.filter(p => p.status === 'paid').reduce((s, p) => s + net(p), 0);
  return (
    <div className="rounded-[28px] bg-[#d3e3fd] text-[#041e49] p-5">
      <p className="text-sm">Paid this week</p>
      <p className="text-[40px] leading-[48px] font-normal tracking-tight">{usd(paidWeek)}</p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-2xl bg-white/70 px-3 py-2">
          <p className="text-xs text-[#444746]">Pending</p>
          <p className="text-base font-medium text-[#8a5a00]">{usd(pending)}</p>
        </div>
        <div className="rounded-2xl bg-white/70 px-3 py-2">
          <p className="text-xs text-[#444746]">Paid total</p>
          <p className="text-base font-medium text-[#0d652d]">{usd(paidAll)}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentRow({ p }: { p: DriverPayment }) {
  const [open, setOpen] = useState(false);
  const adj = p.total_adjustments ?? 0;
  const paid = p.status === 'paid';
  return (
    <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 active:bg-[#f0f4f9]">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{shortLocation(p.origin || '')} → {shortLocation(p.destination || '')}</p>
          <p className="text-xs text-[#444746] truncate">
            #{p.load_reference}{(p.driver_name || p.recipient_name) ? ` · ${p.driver_name || p.recipient_name}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-medium">{usd(net(p))}</p>
          <span className={`px-2 h-5 inline-flex items-center rounded-full text-[10px] font-medium ${paid ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#fef7e0] text-[#8a5a00]'}`}>
            {paid ? 'Paid' : 'Pending'}
          </span>
        </div>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#444746]">
          <span>Rate <b className="text-[#1f1f1f] font-medium">{usd(Number(p.total_rate))}</b></span>
          <span>Share <b className="text-[#1f1f1f] font-medium">{p.percentage_applied}%</b></span>
          <span>Adjustment <b className={`font-medium ${adj > 0 ? 'text-[#0d652d]' : adj < 0 ? 'text-[#b3261e]' : 'text-[#1f1f1f]'}`}>{adj === 0 ? '—' : `${adj > 0 ? '+' : '−'}${usd(Math.abs(adj))}`}</b></span>
          <span>Paid on <b className="text-[#1f1f1f] font-medium">{p.payment_date ? formatDate(p.payment_date) : '—'}</b></span>
        </div>
      )}
    </button>
  );
}

/** Lista por semana: primero lo pendiente, luego lo pagado agrupado por semana de pago */
function PaymentList({ payments }: { payments: DriverPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <span className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#e9eef6] flex items-center justify-center"><Wallet className="h-7 w-7 text-[#444746]" /></span>
        <p className="text-sm text-[#444746]">No payments yet</p>
      </div>
    );
  }
  const pending = payments.filter(p => p.status !== 'paid');
  const weeks = new Map<number, DriverPayment[]>();
  for (const p of payments.filter(p => p.status === 'paid')) {
    const k = weekStart(p.payment_date || p.created_at).getTime();
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k)!.push(p);
  }
  const groups = [
    ...(pending.length ? [{ key: 'pending', title: 'Pending', items: pending }] : []),
    ...[...weeks.entries()].sort((a, b) => b[0] - a[0]).map(([k, items]) => {
      const s = new Date(k);
      return { key: String(k), title: `Week of ${format(s, 'MMM d')} – ${format(endOfWeek(s, { weekStartsOn: 1 }), 'MMM d')}`, items };
    }),
  ];
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.key}>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h2 className="text-sm font-medium text-[#444746]">{g.title}</h2>
            <span className="text-sm font-medium text-[#1f1f1f]">{usd(g.items.reduce((s, p) => s + net(p), 0))}</span>
          </div>
          <div className={`${CARD} overflow-hidden divide-y divide-[#f0f4f9]`}>
            {g.items.map(p => <PaymentRow key={p.id} p={p} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DriverPayments() {
  const { role } = useAuth();
  const { payments, investorPayments, loading, refetch } = useDriverPayments();
  const [view, setView] = useState<'driver' | 'investor'>('driver');

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;

  const isInvestorOnly = role === 'investor';
  const hasInvestorPayments = investorPayments.length > 0;
  const list = isInvestorOnly || view === 'investor' ? investorPayments : payments;

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="px-4 pt-2 pb-[calc(24px+env(safe-area-inset-bottom,0px))] space-y-4">
        <h1 className="text-[28px] leading-9 font-normal">{isInvestorOnly ? 'Investor payments' : 'My payments'}</h1>

        {!isInvestorOnly && hasInvestorPayments && (
          <div className="flex gap-2">
            {([['driver', 'Driver'], ['investor', 'Investor']] as const).map(([k, label]) => {
              const on = view === k;
              return (
                <button key={k} type="button" onClick={() => setView(k)}
                  className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium ${on ? 'bg-[#d3e3fd] text-[#041e49]' : 'border border-[#c4c7c5] text-[#444746]'}`}>
                  {on && <Check className="h-4 w-4" />}{label}
                </button>
              );
            })}
          </div>
        )}

        <Summary payments={list} />
        <PaymentList payments={list} />
      </div>
    </PullToRefresh>
  );
}

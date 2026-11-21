import { useEffect, useState, useCallback } from 'react';
import { LOADS_SELECT } from '@/hooks/useLoads';
import { Package, DollarSign, AlertTriangle, Navigation, Gauge, Route, ChevronRight, Play } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LoadProgressBar } from '@/components/driver-app/LoadProgressBar';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { CARD, BTN_FILLED, BTN_TONAL, cityState, statusMeta } from '@/components/driver-app/driverUi';
import { openUrl, mapsDirectionsUrl } from '@/lib/openUrl';
import { format, isPast, addDays } from 'date-fns';
import InvestorDashboard from './InvestorDashboard';

export default function DriverDashboard() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<any>(null);
  const [activeLoads, setActiveLoads] = useState<any[]>([]);
  const [nextStop, setNextStop] = useState<any>(null);
  const [stats, setStats] = useState({ loadsMonth: 0, earningsMonth: 0, milesMonth: 0, avgRpm: 0 });

  const fetchData = useCallback(async () => {
    if (!profile?.email) return;
    const { data: d } = await supabase.from('drivers').select('*').eq('email', profile.email).maybeSingle();
    if (!d) return;
    setDriver(d);

    const { data: loadsData } = await supabase
      .from('loads')
      .select(LOADS_SELECT)
      .eq('driver_id', d.id)
      .not('status', 'in', '("planned","delivered","paid","tonu","cancelled")')
      .order('pickup_date', { ascending: true });
    const loads = (loadsData as any[] | null) ?? null;
    setActiveLoads(loads || []);

    if (loads && loads.length > 0) {
      const { data: stops } = await supabase
        .from('load_stops')
        .select('*')
        .eq('load_id', loads[0].id)
        .is('arrived_at', null)
        .order('stop_order', { ascending: true })
        .limit(1);
      if (stops && stops.length > 0) setNextStop({ ...stops[0], load: loads[0] });
      else setNextStop(null);
    } else {
      setNextStop(null);
    }

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const { data: monthLoads } = await supabase
      .from('loads')
      .select('id, total_rate, miles')
      .eq('driver_id', d.id)
      .in('status', ['delivered', 'paid'])
      .gte('delivery_date', startOfMonth.toISOString().split('T')[0]);
    const count = monthLoads?.length || 0;
    const earnings = monthLoads?.reduce((s, l) => s + Number(l.total_rate) * ((d.pay_percentage || 30) / 100), 0) || 0;
    const totalMiles = monthLoads?.reduce((s, l) => s + (Number(l.miles) || 0), 0) || 0;
    const totalRate = monthLoads?.reduce((s, l) => s + Number(l.total_rate), 0) || 0;
    const avgRpm = totalMiles > 0 ? totalRate / totalMiles : 0;
    setStats({ loadsMonth: count, earningsMonth: earnings, milesMonth: totalMiles, avgRpm });
  }, [profile?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const alerts: string[] = [];
  if (driver) {
    if (driver.license_expiry && isPast(addDays(new Date(driver.license_expiry), -30))) alerts.push(`License expires ${format(new Date(driver.license_expiry), 'MMM dd')}`);
    if (driver.medical_card_expiry && isPast(addDays(new Date(driver.medical_card_expiry), -30))) alerts.push(`Medical card expires ${format(new Date(driver.medical_card_expiry), 'MMM dd')}`);
  }

  // Investors see their dedicated dashboard
  if (role === 'investor') return <InvestorDashboard />;

  const current = activeLoads[0];
  const others = activeLoads.slice(1);
  const stopForCurrent = nextStop && current && nextStop.load?.id === current.id ? nextStop : null;
  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="px-4 pt-2 space-y-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <h1 className="text-[28px] leading-9 font-normal text-[#1f1f1f]">Hi, {profile?.full_name?.split(' ')[0]}</h1>

        {/* Alertas de documentos por vencer */}
        {alerts.length > 0 && (
          <div className="rounded-[20px] bg-[#fef7e0] text-[#8a5a00] px-4 py-3 space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {a}
              </div>
            ))}
          </div>
        )}

        {/* Carga actual: tarjeta grande con UN botón de la siguiente acción */}
        {current ? (
          <div className={`${CARD} p-5 space-y-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#444746]">Current load · #{current.reference_number}</span>
              <span className={`px-3 h-7 inline-flex items-center rounded-full text-xs font-medium ${statusMeta(current.status).chip}`}>
                {statusMeta(current.status).label}
              </span>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <span className="h-3 w-3 rounded-full border-[3px] border-[#1e8e3e]" />
                <span className="flex-1 w-0.5 my-1 bg-[#dde3ea]" />
                <span className="h-3 w-3 rounded-full bg-[#d93025]" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[22px] leading-7 font-normal truncate">{cityState(current.origin)}</p>
                  {current.pickup_date && <p className="text-sm text-[#444746]">{formatDate(current.pickup_date)}</p>}
                </div>
                <div>
                  <p className="text-[22px] leading-7 font-normal truncate">{cityState(current.destination)}</p>
                  {current.delivery_date && <p className="text-sm text-[#444746]">{formatDate(current.delivery_date)}</p>}
                </div>
              </div>
            </div>

            <LoadProgressBar status={current.status} />

            {stopForCurrent && (
              <div className="rounded-[20px] bg-[#f0f4f9] px-4 py-3 flex items-start gap-3">
                <span className={`mt-0.5 h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${stopForCurrent.stop_type === 'pickup' ? 'bg-[#1e8e3e]' : 'bg-[#d93025]'}`}>
                  {stopForCurrent.stop_type === 'pickup' ? 'P' : 'D'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[#444746]">Next stop · {stopForCurrent.stop_type === 'pickup' ? 'Pick up' : 'Delivery'}{stopForCurrent.time ? ` · ${stopForCurrent.time}` : ''}</p>
                  <p className="text-sm font-medium text-[#1f1f1f]">{stopForCurrent.address}</p>
                </div>
              </div>
            )}

            {stopForCurrent ? (
              <div className="space-y-2">
                <button className={`${BTN_FILLED} w-full`} onClick={() => openUrl(mapsDirectionsUrl(stopForCurrent.address))}>
                  <Navigation className="h-5 w-5" /> Navigate to {stopForCurrent.stop_type === 'pickup' ? 'pickup' : 'delivery'}
                </button>
                <button className={`${BTN_TONAL} w-full`} onClick={() => navigate(`/driver/loads/${current.id}`)}>
                  Open load <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button className={`${BTN_FILLED} w-full`} onClick={() => navigate(`/driver/loads/${current.id}`)}>
                {current.status === 'dispatched' ? <><Play className="h-5 w-5" /> Start route</> : <>Open load <ChevronRight className="h-5 w-5" /></>}
              </button>
            )}
          </div>
        ) : (
          <div className={`${CARD} p-6 text-center`}>
            <span className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#e9eef6] flex items-center justify-center">
              <Package className="h-7 w-7 text-[#444746]" />
            </span>
            <p className="text-base font-medium">No active loads right now</p>
            <p className="text-sm text-[#444746] mt-1">When dispatch assigns you a load it will show up here.</p>
          </div>
        )}

        {/* Más cargas activas */}
        {others.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-[#444746] px-1">Also assigned</h2>
            {others.map(load => (
              <button key={load.id} onClick={() => navigate(`/driver/loads/${load.id}`)} className={`${CARD} w-full text-left px-4 py-3 flex items-center gap-3 active:bg-[#f0f4f9]`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cityState(load.origin)} → {cityState(load.destination)}</p>
                  <p className="text-xs text-[#444746]">#{load.reference_number}{load.pickup_date ? ` · ${formatDate(load.pickup_date)}` : ''}</p>
                </div>
                <span className={`px-2.5 h-6 inline-flex items-center rounded-full text-[11px] font-medium ${statusMeta(load.status).chip}`}>{statusMeta(load.status).label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Este mes */}
        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">This month</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Earnings', value: money(stats.earningsMonth), icon: DollarSign, tint: 'bg-[#c4eed0] text-[#0d652d]' },
              { label: 'Loads', value: String(stats.loadsMonth), icon: Package, tint: 'bg-[#d3e3fd] text-[#041e49]' },
              { label: 'Miles', value: stats.milesMonth.toLocaleString(), icon: Route, tint: 'bg-[#c2e7ff] text-[#004a77]' },
              { label: 'Avg RPM', value: `$${stats.avgRpm.toFixed(2)}`, icon: Gauge, tint: 'bg-[#ffdbcb] text-[#5c1900]' },
            ].map(t => (
              <div key={t.label} className={`${CARD} p-4 flex items-center gap-3`}>
                <span className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center ${t.tint}`}><t.icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-xs text-[#444746]">{t.label}</p>
                  <p className="text-lg font-medium leading-6 truncate">{t.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

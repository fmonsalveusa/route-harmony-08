import { useEffect, useState, useCallback } from 'react';
import { LOADS_SELECT } from '@/hooks/useLoads';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Check, Package } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { CARD, cityState, statusMeta } from '@/components/driver-app/driverUi';
import { LoadProgressBar } from '@/components/driver-app/LoadProgressBar';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';

export default function DriverLoads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<any[]>([]);
  const [investorLoads, setInvestorLoads] = useState<any[]>([]);
  const [driverNames, setDriverNames] = useState<Map<string, string>>(new Map());
  const [ownDriverId, setOwnDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'investor' | 'completed'>('active');

  const fetchLoads = useCallback(async () => {
    if (!profile?.email) return;
    setLoading(true);

    // Cargas propias como driver
    const { data: driver } = await supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle();
    const driverId = driver?.id || null;
    setOwnDriverId(driverId);
    if (driverId) {
      const { data } = await supabase.from('loads').select(LOADS_SELECT).eq('driver_id', driverId).neq('status', 'planned').order('pickup_date', { ascending: false });
      setLoads(data || []);
    } else {
      setLoads([]);
    }

    // ¿Es también investor? → cargas de sus drivers asignados (excluye las propias)
    const { data: inv } = await supabase.from('investors' as any).select('id').ilike('email', profile.email).maybeSingle();
    if (inv && (inv as any).id) {
      const { data: links } = await supabase
        .from('driver_investors' as any)
        .select('driver_id')
        .eq('investor_id', (inv as any).id)
        .eq('is_active', true);
      const assignedIds = ((links as any) || []).map((l: any) => l.driver_id).filter((id: string) => id !== driverId);
      if (assignedIds.length > 0) {
        const { data: invLoadsData } = await supabase
          .from('loads')
          .select(LOADS_SELECT)
          .in('driver_id', assignedIds)
          .neq('status', 'planned')
          .order('pickup_date', { ascending: false });
        setInvestorLoads(invLoadsData || []);

        // Nombres de los drivers para mostrarlos en cada carga del tab Investor
        const { data: drvs } = await supabase
          .from('drivers' as any)
          .select('id, name')
          .in('id', assignedIds);
        setDriverNames(new Map(((drvs as any) || []).map((d: any) => [d.id, d.name])));
      } else {
        setInvestorLoads([]);
      }
    } else {
      setInvestorLoads([]);
    }

    setLoading(false);
  }, [profile?.email]);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  const isAlsoInvestor = investorLoads.length > 0;

  const active = loads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status));

  // Cargas de mis drivers (como investor): activas van a "Your drivers", completadas al archivo
  const investorActive = investorLoads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status));
  const investorCompleted = investorLoads.filter(l => ['delivered', 'paid'].includes(l.status));

  // Completed mezcla mis cargas + las de mis drivers, más recientes primero
  const completed = [...loads.filter(l => ['delivered', 'paid'].includes(l.status)), ...investorCompleted]
    .sort((a, b) => {
      const da = a.delivery_date || a.pickup_date || a.created_at || '';
      const db = b.delivery_date || b.pickup_date || b.created_at || '';
      return db.localeCompare(da);
    });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;

  const rpm = (load: any) => {
    const miles = Number(load.miles) || 0;
    if (miles === 0) return '—';
    return `$${(Number(load.total_rate) / miles).toFixed(2)}`;
  };

  const LoadCard = ({ load, showDriver }: { load: any; showDriver?: boolean }) => {
    const isActive = !['delivered', 'paid', 'tonu', 'cancelled'].includes(load.status);
    const meta = statusMeta(load.status);

    return (
      <button type="button" className={`${CARD} w-full text-left p-4 space-y-3 active:bg-[#f0f4f9] transition-colors`} onClick={() => navigate(`/driver/loads/${load.id}`)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-[#444746] truncate">#{load.reference_number}{load.broker_client ? ` · ${load.broker_client}` : ''}</span>
          <span className={`flex-shrink-0 px-2.5 h-6 inline-flex items-center rounded-full text-[11px] font-medium ${meta.chip}`}>{meta.label}</span>
        </div>

        {showDriver && driverNames.get(load.driver_id) && (
          <div className="flex items-center gap-1.5 text-sm text-[#1f1f1f]">
            <User className="h-4 w-4 text-[#444746]" />
            <span className="font-medium">{driverNames.get(load.driver_id)}</span>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-[#1e8e3e]" />
            <span className="flex-1 w-0.5 my-1 bg-[#dde3ea]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d93025]" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-base font-medium leading-5 truncate">{cityState(load.origin)}</p>
            <p className="text-base font-medium leading-5 truncate">{cityState(load.destination)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-[#1f1f1f]">${Number(load.total_rate).toLocaleString()}</span>
          <span className="text-[#444746]">{Number(load.miles) > 0 ? `${Number(load.miles).toLocaleString()} mi` : '— mi'}</span>
          <span className="text-[#444746]">{rpm(load)}/mi</span>
          {load.delivery_date && (
            <span className="text-[#444746] inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {isActive ? 'Due' : 'Delivered'} {formatDate(load.delivery_date)}
            </span>
          )}
        </div>

        {isActive && <LoadProgressBar status={load.status} compact />}
      </button>
    );
  };

  const views = [
    { key: 'active' as const, label: 'Active', count: active.length },
    ...(isAlsoInvestor ? [{ key: 'investor' as const, label: 'Your drivers', count: investorActive.length }] : []),
    { key: 'completed' as const, label: 'Delivered', count: completed.length },
  ];
  const shown = view === 'active' ? active : view === 'investor' ? investorActive : completed;
  const empty = view === 'active' ? 'No active loads' : view === 'investor' ? 'No active loads from your drivers' : 'No delivered loads yet';

  return (
    <PullToRefresh onRefresh={fetchLoads}>
      <div className="px-4 pt-2 pb-[calc(24px+env(safe-area-inset-bottom,0px))] space-y-3">
        <h1 className="text-[28px] leading-9 font-normal">My loads</h1>

        {/* Chips de filtro */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {views.map(v => {
            const on = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
                  on ? 'bg-[#d3e3fd] text-[#041e49]' : 'border border-[#c4c7c5] text-[#444746]'
                }`}
              >
                {on && <Check className="h-4 w-4" />}
                {v.label} <span className={on ? 'text-[#041e49]/70' : 'text-[#747775]'}>{v.count}</span>
              </button>
            );
          })}
        </div>

        {view === 'investor' && <p className="text-xs text-[#444746] px-1">Active loads from drivers assigned to you as investor</p>}

        {shown.length === 0 ? (
          <div className={`${CARD} p-8 text-center`}>
            <span className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#e9eef6] flex items-center justify-center">
              <Package className="h-7 w-7 text-[#444746]" />
            </span>
            <p className="text-sm text-[#444746]">{empty}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(l => (
              <LoadCard key={l.id} load={l} showDriver={view === 'investor' || (view === 'completed' && l.driver_id !== ownDriverId)} />
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

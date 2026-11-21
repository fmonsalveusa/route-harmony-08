import { useState, useEffect } from 'react';
import { useLoads } from '@/hooks/useLoads';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverPayments } from '@/hooks/useDriverPayments';
import { supabase } from '@/integrations/supabase/client';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { MapPin, ChevronDown, ChevronUp, FileText, DollarSign, User, Check, Package } from 'lucide-react';
import { CARD, BTN_TONAL, statusMeta } from '@/components/driver-app/driverUi';
import { openUrl } from '@/lib/openUrl';
import { formatDate } from '@/lib/dateUtils';

// "Ciudad, ST" de una dirección completa
function cityState(addr: string) {
  if (!addr) return '—';
  const parts = addr.split(',').map(x => x.trim());
  for (let i = parts.length - 1; i >= 1; i--) {
    const m = parts[i].match(/\b([A-Z]{2})\b/);
    if (m) return `${parts[i - 1] || parts[0]}, ${m[1]}`;
  }
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
}

export default function InvestorLoads() {
  const { loads, loading, fetchLoads } = useLoads();
  const { investorPayments } = useDriverPayments();
  const { profile } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [view, setView] = useState<'active' | 'done'>('active');

  // Drivers asignados a este investor (vía email → investor → driver_investors)
  const [myDriverIds, setMyDriverIds] = useState<Set<string> | null>(null);
  const [driverNames, setDriverNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!profile?.email) return;
    (async () => {
      const { data: inv } = await supabase
        .from('investors' as any)
        .select('id')
        .ilike('email', profile.email)
        .maybeSingle();
      if (!inv || !(inv as any).id) { setMyDriverIds(new Set()); return; }
      const { data: links } = await supabase
        .from('driver_investors' as any)
        .select('driver_id')
        .eq('investor_id', (inv as any).id)
        .eq('is_active', true);
      const ids = ((links as any) || []).map((l: any) => l.driver_id);
      setMyDriverIds(new Set(ids));

      // Nombres de los drivers para mostrarlos en cada carga
      if (ids.length > 0) {
        const { data: drvs } = await supabase
          .from('drivers' as any)
          .select('id, name')
          .in('id', ids);
        setDriverNames(new Map(((drvs as any) || []).map((d: any) => [d.id, d.name])));
      }
    })();
  }, [profile?.email]);

  // Cargas de los drivers asignados (activas + entregadas)
  const myLoads = (myDriverIds
    ? loads.filter(l => l.driver_id && myDriverIds.has(l.driver_id))
    : []
  ).sort((a, b) => {
    const da = a.pickup_date || a.created_at;
    const db = b.pickup_date || b.created_at;
    return db.localeCompare(da);
  });

  const openPdf = async (url: string, loadId: string) => {
    if (!url) return;
    setLoadingPdf(loadId);
    try {
      // Siempre regeneramos el signed URL desde la ruta (los guardados expiran)
      let path = url;
      if (path.includes('/object/sign/driver-documents/')) {
        path = path.split('/object/sign/driver-documents/')[1].split('?')[0];
      } else if (path.includes('driver-documents/')) {
        path = path.split('driver-documents/')[1];
      }
      try { path = decodeURIComponent(path); } catch { /* ya decodificado */ }

      const { data } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        await openUrl(data.signedUrl); // en la app instalada window.open no abre nada
      }
    } catch (e) {
      console.error('Error opening PDF:', e);
    } finally {
      setLoadingPdf(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;
  }

  const isDone = (s: string) => ['delivered', 'paid', 'tonu', 'cancelled'].includes(s);
  const activeLoads = myLoads.filter(l => !isDone(l.status));
  const doneLoads = myLoads.filter(l => isDone(l.status));
  const shown = view === 'active' ? activeLoads : doneLoads;

  return (
    <PullToRefresh onRefresh={fetchLoads}>
      <div className="px-4 pt-2 space-y-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <div>
          <h1 className="text-[28px] leading-9 font-normal">My loads</h1>
          <p className="text-sm text-[#444746]">{myLoads.length} load{myLoads.length !== 1 ? 's' : ''} linked to your investment</p>
        </div>

        <div className="flex gap-2">
          {([['active', 'Active', activeLoads.length], ['done', 'Delivered', doneLoads.length]] as const).map(([k, label, n]) => {
            const on = view === k;
            return (
              <button key={k} type="button" onClick={() => setView(k)}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium ${on ? 'bg-[#d3e3fd] text-[#041e49]' : 'border border-[#c4c7c5] text-[#444746]'}`}>
                {on && <Check className="h-4 w-4" />}{label} <span className={on ? 'text-[#041e49]/70' : 'text-[#747775]'}>{n}</span>
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <div className={`${CARD} p-8 text-center`}>
            <span className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#e9eef6] flex items-center justify-center"><Package className="h-7 w-7 text-[#444746]" /></span>
            <p className="text-sm text-[#444746]">No loads here yet</p>
          </div>
        ) : (
          shown.map(load => {
            const isExpanded = expandedId === load.id;
            const meta = statusMeta(load.status);
            const payment = investorPayments.find(p => p.load_id === load.id);

            return (
              <div key={load.id} className={`${CARD} overflow-hidden`}>
                <button type="button" className="w-full text-left p-4 space-y-3 active:bg-[#f0f4f9]" onClick={() => setExpandedId(isExpanded ? null : load.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[#444746] truncate">#{load.reference_number}{load.broker_client ? ` · ${load.broker_client}` : ''}</span>
                    <span className={`flex-shrink-0 px-2.5 h-6 inline-flex items-center rounded-full text-[11px] font-medium ${meta.chip}`}>{meta.label}</span>
                  </div>

                  {load.driver_id && driverNames.get(load.driver_id) && (
                    <div className="flex items-center gap-1.5 text-sm">
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
                      <p className="text-base font-medium leading-5 truncate">{cityState(load.origin)} <span className="text-xs font-normal text-[#444746]">· {formatDate(load.pickup_date)}</span></p>
                      <p className="text-base font-medium leading-5 truncate">{cityState(load.destination)} <span className="text-xs font-normal text-[#444746]">· {formatDate(load.delivery_date)}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#444746]">Rate <b className="text-[#1f1f1f] font-medium">${Number(load.total_rate).toLocaleString()}</b></span>
                    <span className="flex items-center gap-1">
                      {payment && <span className="text-sm text-[#444746]">My cut <b className="text-[#0b57d0] font-medium">${Number(payment.amount).toLocaleString()}</b></span>}
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-[#444746]" /> : <ChevronDown className="h-5 w-5 text-[#444746]" />}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Miles', Number(load.miles || 0).toLocaleString()],
                        ['Empty mi', Number(load.empty_miles || 0).toLocaleString()],
                        ['RPM', load.miles && Number(load.miles) > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—'],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-2xl bg-[#f0f4f9] p-2">
                          <div className="text-[11px] text-[#444746]">{l}</div>
                          <div className="text-sm font-medium">{v}</div>
                        </div>
                      ))}
                    </div>

                    {payment && (
                      <div className="flex items-center justify-between rounded-2xl bg-[#d3e3fd] text-[#041e49] px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-medium"><DollarSign className="h-4 w-4" /> My payment</span>
                        <span className="flex items-center gap-2">
                          <span className="text-base font-medium">${Number(payment.amount).toLocaleString()}</span>
                          <span className={`px-2 h-5 inline-flex items-center rounded-full text-[10px] font-medium ${payment.status === 'paid' ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#fef7e0] text-[#8a5a00]'}`}>
                            {payment.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </span>
                      </div>
                    )}

                    {load.pdf_url && (
                      <button
                        type="button"
                        className={`${BTN_TONAL} w-full`}
                        onClick={() => openPdf(load.pdf_url!, load.id)}
                        disabled={loadingPdf === load.id}
                      >
                        {loadingPdf === load.id
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#041e49] border-t-transparent" />
                          : <FileText className="h-4 w-4" />}
                        Rate Confirmation
                      </button>
                    )}

                    <div className="space-y-1.5 text-xs text-[#444746]">
                      <div className="flex gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#1e8e3e] flex-shrink-0 mt-0.5" /><span>{load.origin}</span></div>
                      <div className="flex gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#d93025] flex-shrink-0 mt-0.5" /><span>{load.destination}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </PullToRefresh>
  );
}

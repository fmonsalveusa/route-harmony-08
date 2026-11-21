import { useEffect, useState, useCallback } from 'react';
import { LOADS_SELECT } from '@/hooks/useLoads';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StopCard } from '@/components/driver-app/StopCard';
import { ArrowLeft, Play, FileText, Check } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { CARD, BTN_FILLED, BTN_TONAL, cityState, statusMeta } from '@/components/driver-app/driverUi';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { LoadProgressBar } from '@/components/driver-app/LoadProgressBar';

export default function DriverLoadDetail() {
  const { loadId } = useParams<{ loadId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [podDocs, setPodDocs] = useState<{ id: string; file_name: string; file_url: string; stop_id: string | null; created_at: string; file_type: string }[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!loadId || !profile?.email) return;

    const { data: d } = await supabase.from('drivers').select('*').eq('email', profile.email).maybeSingle();
    if (d) setDriver(d);

    const [loadRes, stopsRes, podsRes, paymentsRes] = await Promise.all([
      supabase.from('loads').select(LOADS_SELECT).eq('id', loadId).maybeSingle(),
      supabase.from('load_stops').select('*').eq('load_id', loadId).order('stop_order'),
      supabase.from('pod_documents').select('*').eq('load_id', loadId),
      d ? supabase.from('payments').select('*').eq('load_id', loadId).eq('recipient_id', d.id) : Promise.resolve({ data: [] }),
    ]);

    setLoad(loadRes.data);
    setStops((stopsRes.data as any) || []);
    setPodDocs((podsRes.data as any) || []);
    setPayments((paymentsRes.data as any) || []);
    setLoading(false);
  }, [loadId, profile?.email]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleChangeStatus = async (newStatus: string, label: string) => {
    await supabase.from('loads').update({ status: newStatus }).eq('id', loadId!);
    const dName = driver?.name || profile?.full_name || '';
    await createNotification({
      type: 'status_changed',
      title: `${label} - ${dName}`,
      message: `${dName} | Load #${load?.reference_number} | ${load?.origin} → ${load?.destination}`,
      load_id: loadId,
    });
    toast({ title: `Status: ${label}` });
    fetchAll();
  };

  const handleStartRoute = async () => handleChangeStatus('in_transit', 'In Transit');

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;
  if (!load) return <div className="p-4 text-center text-muted-foreground">Load not found</div>;

  const deliveryStops = stops.filter(s => s.stop_type === 'delivery');
  const lastDelivery = deliveryStops[deliveryStops.length - 1];
  const lastDeliveryId = lastDelivery?.id;

  const openRateConfirmation = async () => {
    try {
      // Siempre regeneramos un signed URL fresco desde la RUTA del archivo.
      // Aunque pdf_url venga como URL completa vieja (con token expirado),
      // extraemos la ruta interna y creamos un link nuevo.
      let path = load.pdf_url;
      if (path.includes('/object/sign/driver-documents/')) {
        path = path.split('/object/sign/driver-documents/')[1].split('?')[0];
      } else if (path.includes('driver-documents/')) {
        path = path.split('driver-documents/')[1];
      }
      try { path = decodeURIComponent(path); } catch { /* ya estaba decodificado */ }

      const { data, error } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        toast({ title: 'Could not open document', variant: 'destructive' });
        return;
      }
      // En la app instalada (Capacitor), target="_blank" NO abre nada: plugin Browser
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.signedUrl });
      } else {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
      }
    } catch {
      toast({ title: 'Error opening document', variant: 'destructive' });
    }
  };

  const meta = statusMeta(load.status);
  const rpm = Number(load.miles) > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—';
  // La primera parada sin llegada es la "actual" (se resalta en la línea de tiempo)
  const currentStopId = stops.find(s => !s.arrived_at)?.id;

  return (
    <div className="pb-8 px-4 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-1 -ml-2 pt-1">
        <button onClick={() => navigate(-1)} aria-label="Back" className="h-11 w-11 flex items-center justify-center rounded-full active:bg-[#e9eef6]">
          <ArrowLeft className="h-6 w-6 text-[#1f1f1f]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] leading-7 font-normal truncate">Load #{load.reference_number}</h1>
          {load.broker_client && <p className="text-sm text-[#444746] truncate">{load.broker_client}</p>}
        </div>
        <span className={`px-3 h-7 inline-flex items-center rounded-full text-xs font-medium flex-shrink-0 ${meta.chip}`}>{meta.label}</span>
      </div>

      {/* Ruta + progreso */}
      <div className={`${CARD} p-5 space-y-4`}>
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <span className="h-3 w-3 rounded-full border-[3px] border-[#1e8e3e]" />
            <span className="flex-1 w-0.5 my-1 bg-[#dde3ea]" />
            <span className="h-3 w-3 rounded-full bg-[#d93025]" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className="text-lg font-normal truncate">{cityState(load.origin)}</p>
              {load.pickup_date && <p className="text-sm text-[#444746]">{formatDate(load.pickup_date)}</p>}
            </div>
            <div>
              <p className="text-lg font-normal truncate">{cityState(load.destination)}</p>
              {load.delivery_date && <p className="text-sm text-[#444746]">{formatDate(load.delivery_date)}</p>}
            </div>
          </div>
        </div>
        <LoadProgressBar status={load.status} />

        {load.status === 'dispatched' && (
          <button className={`${BTN_FILLED} w-full`} onClick={handleStartRoute}>
            <Play className="h-5 w-5" /> Start route
          </button>
        )}
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total rate', value: `$${Number(load.total_rate).toLocaleString()}` },
          { label: 'Driver pay', value: `$${Number(load.driver_pay_amount || 0).toLocaleString()}`, green: true },
          { label: 'Miles', value: Number(load.miles) > 0 ? Number(load.miles).toLocaleString() : '—' },
          { label: 'RPM', value: rpm },
        ].map(t => (
          <div key={t.label} className={`${CARD} px-4 py-3`}>
            <p className="text-xs text-[#444746]">{t.label}</p>
            <p className={`text-lg font-medium leading-6 ${t.green ? 'text-[#0d652d]' : ''}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {load.pdf_url && (
        <button className={`${BTN_TONAL} w-full`} onClick={openRateConfirmation}>
          <FileText className="h-4 w-4" /> View Rate Confirmation
        </button>
      )}

      {/* Paradas en línea de tiempo */}
      <div>
        <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">Stops</h2>
        <div>
          {stops.map((stop, i) => {
            const done = !!stop.arrived_at;
            const isCurrent = stop.id === currentStopId;
            const last = i === stops.length - 1;
            return (
              <div key={stop.id} className="flex gap-3">
                <div className="flex flex-col items-center w-8 flex-shrink-0">
                  <span className={`mt-4 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    done ? 'bg-[#1e8e3e] text-white'
                    : isCurrent ? 'bg-[#0b57d0] text-white ring-4 ring-[#d3e3fd]'
                    : 'bg-white text-[#444746] border-2 border-[#c4c7c5]'
                  }`}>
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  {!last && <span className={`flex-1 w-0.5 mt-1 ${done ? 'bg-[#1e8e3e]' : 'bg-[#dde3ea]'}`} />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <StopCard
                    stop={stop}
                    loadRef={load.reference_number}
                    driverName={profile?.full_name || ''}
                    onUpdate={fetchAll}
                    podDocuments={podDocs}
                    loadStatus={load.status}
                    isLastDelivery={stop.id === lastDeliveryId}
                    hideBrokerButton={driver?.service_type === 'dispatch_service'}
                    isCurrent={isCurrent}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mis pagos de esta carga */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">My payments</h2>
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className={`${CARD} px-4 py-3 flex items-center justify-between`}>
                <div>
                  <p className="text-base font-medium">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-[#444746]">{p.percentage_applied}% of ${Number(p.total_rate).toLocaleString()}</p>
                </div>
                <span className={`px-3 h-7 inline-flex items-center rounded-full text-xs font-medium ${p.status === 'paid' ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#fef7e0] text-[#8a5a00]'}`}>
                  {p.status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

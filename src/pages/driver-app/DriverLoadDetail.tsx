import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StopCard } from '@/components/driver-app/StopCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play, DollarSign, FileText } from 'lucide-react';
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
      supabase.from('loads').select('*').eq('id', loadId).maybeSingle(),
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

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  if (!load) return <div className="p-4 text-center text-muted-foreground">Load not found</div>;

  const deliveryStops = stops.filter(s => s.stop_type === 'delivery');
  const lastDelivery = deliveryStops[deliveryStops.length - 1];
  const lastDeliveryId = lastDelivery?.id;

  const formatCityState = (location: string) => {
    if (!location) return '—';
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return location;
  };

  const statusBgStyle = (status: string) => {
    const colors: Record<string, string> = {
      dispatched: 'linear-gradient(135deg, hsl(80,60%,45%,0.1), hsl(80,60%,45%,0.03))',
      in_transit: 'linear-gradient(135deg, hsl(152,60%,40%,0.1), hsl(152,60%,40%,0.03))',
      on_site_pickup: 'linear-gradient(135deg, hsl(174,60%,42%,0.1), hsl(174,60%,42%,0.03))',
      picked_up: 'linear-gradient(135deg, hsl(217,78%,50%,0.1), hsl(217,78%,50%,0.03))',
      on_site_delivery: 'linear-gradient(135deg, hsl(245,58%,52%,0.1), hsl(245,58%,52%,0.03))',
      delivered: 'linear-gradient(135deg, hsl(270,50%,55%,0.1), hsl(270,50%,55%,0.03))',
      paid: 'linear-gradient(135deg, hsl(152,60%,40%,0.1), hsl(152,60%,40%,0.03))',
    };
    return colors[status] || colors.dispatched;
  };

  return (
    <div className="pb-24 space-y-4">
      {/* Status-colored header */}
      <div className="p-4 rounded-b-2xl" style={{ background: statusBgStyle(load.status) }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-base text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-5 w-5" /> Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{load.reference_number}</h1>
            <p className="text-sm text-muted-foreground">{load.broker_client}</p>
          </div>
          <Badge className={
            load.status === 'in_transit' ? 'bg-info text-info-foreground'
            : load.status === 'on_site_pickup' ? 'bg-warning text-warning-foreground'
            : load.status === 'picked_up' ? 'bg-primary text-primary-foreground'
            : load.status === 'on_site_delivery' ? 'bg-warning text-warning-foreground'
            : load.status === 'delivered' ? 'bg-success text-success-foreground'
            : load.status === 'paid' ? 'bg-success text-success-foreground'
            : 'bg-warning text-warning-foreground'
          }>
            {load.status === 'on_site_pickup' ? 'On Site - Pickup'
             : load.status === 'picked_up' ? 'Picked Up'
             : load.status === 'on_site_delivery' ? 'On Site - Delivery'
             : load.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <LoadProgressBar status={load.status} />
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Route Timeline */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-3 h-3 rounded-full bg-success" />
                <div className="w-px h-8 border-l-2 border-dashed border-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-destructive" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-base font-bold">{formatCityState(load.origin)}</p>
                  <p className="text-xs text-muted-foreground">{load.pickup_date ? new Date(load.pickup_date).toLocaleDateString() : ''}</p>
                </div>
                <div>
                  <p className="text-base font-bold">{formatCityState(load.destination)}</p>
                  <p className="text-xs text-muted-foreground">{load.delivery_date ? new Date(load.delivery_date).toLocaleDateString() : ''}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Grid */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Rate</p>
                <p className="text-lg font-bold text-primary">${Number(load.total_rate).toLocaleString()}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">RPM</p>
                <p className="text-lg font-bold">{Number(load.miles) > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—'}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Miles</p>
                <p className="text-lg font-bold">{Number(load.miles) > 0 ? Number(load.miles).toLocaleString() : '—'}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Driver Pay</p>
                <p className="text-lg font-bold text-success">${Number(load.driver_pay_amount || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Confirmation PDF */}
        {load.pdf_url && (
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
            onClick={async (e) => {
              e.stopPropagation();
              const win = window.open('', '_blank');
              try {
                const path = load.pdf_url.includes('driver-documents/') 
                  ? load.pdf_url.split('driver-documents/')[1] 
                  : load.pdf_url;
                const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
                if (data?.signedUrl && win) {
                  win.location.href = data.signedUrl;
                } else {
                  win?.close();
                  toast({ title: 'Could not open document', variant: 'destructive' });
                }
              } catch {
                win?.close();
                toast({ title: 'Error opening document', variant: 'destructive' });
              }
            }}
          >
            <FileText className="h-4 w-4" /> View Rate Confirmation
          </Button>
        )}

        {/* Start Route button */}
        {load.status === 'dispatched' && (
          <Button className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" size="lg" onClick={handleStartRoute}>
            <Play className="h-5 w-5" /> Start Route
          </Button>
        )}

        {/* Stops */}
        <div>
          <h2 className="text-base font-semibold mb-2">Stops</h2>
          <div className="space-y-3">
            {stops.map(stop => (
              <StopCard
                key={stop.id}
                stop={stop}
                loadRef={load.reference_number}
                driverName={profile?.full_name || ''}
                onUpdate={fetchAll}
                podDocuments={podDocs}
                loadStatus={load.status}
                isLastDelivery={stop.id === lastDeliveryId}
              />
            ))}
          </div>
        </div>

        {/* Payments section */}
        {payments.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2 flex items-center gap-1"><DollarSign className="h-5 w-5" /> My Payments</h2>
            <div className="space-y-2">
              {payments.map((p: any) => (
                <Card key={p.id} className={`border-l-[3px] ${p.status === 'paid' ? 'border-l-success' : 'border-l-warning'}`}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-base font-medium">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-sm text-muted-foreground">{p.percentage_applied}% of ${Number(p.total_rate).toLocaleString()}</p>
                    </div>
                    <Badge className={p.status === 'paid' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                      {p.status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

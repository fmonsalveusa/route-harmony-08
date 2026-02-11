import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StopCard } from '@/components/driver-app/StopCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play, CheckCircle2, DollarSign } from 'lucide-react';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { generatePaymentsForLoad } from '@/hooks/usePayments';

export default function DriverLoadDetail() {
  const { loadId } = useParams<{ loadId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [podDocs, setPodDocs] = useState<any[]>([]);
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

  const handleStartRoute = async () => {
    await supabase.from('loads').update({ status: 'in_transit' }).eq('id', loadId!);
    await createNotification({
      type: 'status_changed',
      title: 'Route started',
      message: `${profile?.full_name} started route for load ${load?.reference_number}`,
      load_id: loadId,
    });
    toast({ title: 'Route started!' });
    fetchAll();
  };

  const handleMarkDelivered = async () => {
    await supabase.from('loads').update({ status: 'delivered' }).eq('id', loadId!);

    // Generate payments
    if (driver && load) {
      const { data: dispatcherData } = await supabase.from('dispatchers').select('*').eq('id', load.dispatcher_id).maybeSingle();
      await generatePaymentsForLoad(
        { id: load.id, reference_number: load.reference_number, total_rate: load.total_rate, driver_id: load.driver_id, dispatcher_id: load.dispatcher_id },
        driver ? { id: driver.id, name: driver.name, pay_percentage: driver.pay_percentage, investor_pay_percentage: driver.investor_pay_percentage, investor_name: driver.investor_name, service_type: driver.service_type } : null,
        dispatcherData ? { id: dispatcherData.id, name: dispatcherData.name, commission_percentage: dispatcherData.commission_percentage, dispatch_service_percentage: dispatcherData.dispatch_service_percentage } : null,
      );
    }

    await createNotification({
      type: 'status_changed',
      title: 'Load delivered!',
      message: `${profile?.full_name} marked load ${load?.reference_number} as delivered`,
      load_id: loadId,
    });
    toast({ title: 'Marked as Delivered!' });
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  if (!load) return <div className="p-4 text-center text-muted-foreground">Load not found</div>;

  const deliveryStops = stops.filter(s => s.stop_type === 'delivery');
  const lastDelivery = deliveryStops[deliveryStops.length - 1];
  const lastDeliveryArrived = lastDelivery?.arrived_at;
  const hasPodsOnLastDelivery = lastDelivery ? podDocs.some(p => p.stop_id === lastDelivery.id) : false;
  const canDeliver = load.status === 'in_transit' && lastDeliveryArrived && (hasPodsOnLastDelivery || podDocs.length > 0);

  return (
    <div className="p-4 pb-24 space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Load header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{load.reference_number}</h1>
          <p className="text-xs text-muted-foreground">{load.broker_client}</p>
        </div>
        <Badge className={
          load.status === 'in_transit' ? 'bg-info text-info-foreground'
          : load.status === 'delivered' ? 'bg-success text-success-foreground'
          : load.status === 'paid' ? 'bg-success text-success-foreground'
          : 'bg-warning text-warning-foreground'
        }>
          {load.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Rate info */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Total Rate</div>
          <div className="text-lg font-bold text-primary">${Number(load.total_rate).toLocaleString()}</div>
        </CardContent>
      </Card>

      {/* Start Route button */}
      {load.status === 'dispatched' && (
        <Button className="w-full gap-2" size="lg" onClick={handleStartRoute}>
          <Play className="h-5 w-5" /> Start Route
        </Button>
      )}

      {/* Stops */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Stops</h2>
        <div className="space-y-3">
          {stops.map(stop => (
            <StopCard
              key={stop.id}
              stop={stop}
              loadRef={load.reference_number}
              driverName={profile?.full_name || ''}
              onUpdate={fetchAll}
              podDocuments={podDocs}
            />
          ))}
        </div>
      </div>

      {/* Mark Delivered */}
      {canDeliver && (
        <Button className="w-full gap-2 bg-success hover:bg-success/90" size="lg" onClick={handleMarkDelivered}>
          <CheckCircle2 className="h-5 w-5" /> Mark as Delivered
        </Button>
      )}

      {/* Payments section */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1"><DollarSign className="h-4 w-4" /> My Payments</h2>
          <div className="space-y-2">
            {payments.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{p.percentage_applied}% of ${Number(p.total_rate).toLocaleString()}</p>
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
  );
}

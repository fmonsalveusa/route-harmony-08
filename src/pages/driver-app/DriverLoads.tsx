import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadProgressBar } from '@/components/driver-app/LoadProgressBar';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';

export default function DriverLoads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoads = useCallback(async () => {
    if (!profile?.email) return;
    setLoading(true);
    const { data: driver } = await supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle();
    if (!driver) { setLoading(false); return; }
    const { data } = await supabase.from('loads').select('*').eq('driver_id', driver.id).order('pickup_date', { ascending: false });
    setLoads(data || []);
    setLoading(false);
  }, [profile?.email]);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      dispatched: 'bg-warning text-warning-foreground',
      in_transit: 'bg-info text-info-foreground',
      on_site_pickup: 'bg-warning text-warning-foreground',
      picked_up: 'bg-primary text-primary-foreground',
      on_site_delivery: 'bg-warning text-warning-foreground',
      delivered: 'bg-success text-success-foreground',
      paid: 'bg-success text-success-foreground',
      pending: 'bg-muted text-muted-foreground',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      on_site_pickup: 'On Site - Pickup',
      picked_up: 'Picked Up',
      on_site_delivery: 'On Site - Delivery',
      in_transit: 'In Transit',
    };
    return labels[status] || status.replace('_', ' ');
  };

  const statusBorderColor = (status: string) => {
    const colors: Record<string, string> = {
      dispatched: 'border-l-[hsl(80,60%,45%)]',
      in_transit: 'border-l-[hsl(152,60%,40%)]',
      on_site_pickup: 'border-l-[hsl(174,60%,42%)]',
      picked_up: 'border-l-[#266aad]',
      on_site_delivery: 'border-l-[#266aad]',
      delivered: 'border-l-[hsl(270,50%,55%)]',
      paid: 'border-l-[hsl(152,60%,40%)]',
    };
    return colors[status] || 'border-l-muted';
  };

  const active = loads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status));
  const completed = loads.filter(l => ['delivered', 'paid'].includes(l.status));

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const formatCityState = (location: string) => {
    if (!location) return '—';
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return location;
  };

  const rpm = (load: any) => {
    const miles = Number(load.miles) || 0;
    if (miles === 0) return '—';
    return `$${(Number(load.total_rate) / miles).toFixed(2)}`;
  };

  const LoadCard = ({ load }: { load: any }) => {
    const isActive = !['delivered', 'paid', 'tonu', 'cancelled'].includes(load.status);

    return (
      <Card className={`cursor-pointer hover:shadow-md transition-shadow border-l-[3px] ${statusBorderColor(load.status)}`} onClick={() => navigate(`/driver/loads/${load.id}`)}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold">Load #{load.reference_number}</span>
            <Badge className={statusBadge(load.status)}>{statusLabel(load.status)}</Badge>
          </div>

          {/* Route Timeline */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <div className="w-px h-4 border-l border-dashed border-muted-foreground/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-sm font-semibold leading-none">{formatCityState(load.origin)}</p>
              <p className="text-sm font-semibold leading-none">{formatCityState(load.destination)}</p>
            </div>
          </div>

          {/* Data Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-semibold text-primary">${Number(load.total_rate).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">RPM</span>
              <span className="font-semibold">{rpm(load)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Miles</span>
              <span className="font-semibold">{Number(load.miles) > 0 ? Number(load.miles).toLocaleString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Broker</span>
              <span className="font-medium truncate max-w-[100px]">{load.broker_client || '—'}</span>
            </div>
          </div>

          {load.delivery_date && (
            <div className="text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 inline mr-1" />
              {isActive ? 'Est. Delivery' : 'Delivered'}: <span className="font-medium text-foreground">{formatDate(load.delivery_date)}</span>
            </div>
          )}

          {isActive && <LoadProgressBar status={load.status} />}
        </CardContent>
      </Card>
    );
  };

  return (
    <PullToRefresh onRefresh={fetchLoads}>
      <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
        <h1 className="text-xl font-bold mb-3">My Loads</h1>
        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="space-y-2 mt-3">
            {active.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No active loads</p> : active.map(l => <LoadCard key={l.id} load={l} />)}
          </TabsContent>
          <TabsContent value="completed" className="space-y-2 mt-3">
            {completed.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No completed loads yet</p> : completed.map(l => <LoadCard key={l.id} load={l} />)}
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DriverLoads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.email) return;
    const fetch = async () => {
      const { data: driver } = await supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle();
      if (!driver) { setLoading(false); return; }
      const { data } = await supabase.from('loads').select('*').eq('driver_id', driver.id).order('pickup_date', { ascending: false });
      setLoads(data || []);
      setLoading(false);
    };
    fetch();
  }, [profile?.email]);

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

  const active = loads.filter(l => !['delivered', 'paid', 'tonu', 'cancelled'].includes(l.status));
  const completed = loads.filter(l => ['delivered', 'paid'].includes(l.status));

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const formatCityState = (location: string) => {
    if (!location) return '—';
    // Try to extract city, state from full address
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
    const isActive = ['dispatched', 'in_transit'].includes(load.status);
    const dateLabel = isActive ? 'Est. Delivery' : 'Delivered';
    const dateValue = isActive ? load.delivery_date : load.delivery_date;

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/driver/loads/${load.id}`)}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Load #{load.reference_number}</span>
            <Badge className={statusBadge(load.status)}>{statusLabel(load.status)}</Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-success" />
              <span className="truncate">{formatCityState(load.origin)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-destructive" />
              <span className="truncate">{formatCityState(load.destination)}</span>
            </div>
          </div>

          {load.broker_client && (
            <div className="text-xs">
              <span className="text-muted-foreground">Broker: </span>
              <span className="font-medium">{load.broker_client}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground">Rate: </span>
              <span className="font-semibold text-primary">${Number(load.total_rate).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">RPM: </span>
              <span className="font-semibold">{rpm(load)}</span>
            </div>
          </div>

          {dateValue && (
            <div className="text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              {dateLabel}: <span className="font-medium text-foreground">{formatDate(dateValue)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 pb-20">
      <h1 className="text-lg font-bold mb-3">My Loads</h1>
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
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Package, DollarSign, MapPin, AlertTriangle, Calendar, Navigation, Gauge, Route } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadProgressBar } from '@/components/driver-app/LoadProgressBar';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
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

    const { data: loads } = await supabase
      .from('loads')
      .select('*')
      .eq('driver_id', d.id)
      .not('status', 'in', '("delivered","paid","tonu","cancelled")')
      .order('pickup_date', { ascending: true });
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

  const formatCityState = (location: string) => {
    if (!location) return '—';
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return location;
  };

  const statusBorderColor = (status: string) => {
    const colors: Record<string, string> = {
      dispatched: 'border-l-[hsl(80,60%,45%)]',
      in_transit: 'border-l-[hsl(152,60%,40%)]',
      on_site_pickup: 'border-l-[hsl(174,60%,42%)]',
      picked_up: 'border-l-[hsl(217,78%,50%)]',
      on_site_delivery: 'border-l-[hsl(245,58%,52%)]',
    };
    return colors[status] || 'border-l-accent';
  };

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="p-5 space-y-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
        <div>
          <h1 className="text-2xl font-bold">Hello, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-base text-muted-foreground">Here's your overview</p>
        </div>

        {/* Stats Grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center gap-2 bg-primary/5">
              <div className="p-2 rounded-full bg-primary/10"><Package className="h-6 w-6 text-primary" /></div>
              <p className="text-xs font-medium text-muted-foreground">Loads</p>
              <p className="text-2xl font-bold">{stats.loadsMonth}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center gap-2 bg-success/5">
              <div className="p-2 rounded-full bg-success/10"><DollarSign className="h-6 w-6 text-success" /></div>
              <p className="text-xs font-medium text-muted-foreground">Earnings</p>
              <p className="text-2xl font-bold">${stats.earningsMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center gap-2 bg-info/5">
              <div className="p-2 rounded-full bg-info/10"><Route className="h-6 w-6 text-info" /></div>
              <p className="text-xs font-medium text-muted-foreground">Miles</p>
              <p className="text-2xl font-bold">{stats.milesMonth.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center gap-2 bg-accent/5">
              <div className="p-2 rounded-full bg-accent/10"><Gauge className="h-6 w-6 text-accent" /></div>
              <p className="text-xs font-medium text-muted-foreground">Avg RPM</p>
              <p className="text-2xl font-bold">${stats.avgRpm.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Next Stop Section */}
        {nextStop && (
          <Card className="border-accent/30 overflow-hidden">
            <div className="h-1 bg-accent" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${nextStop.stop_type === 'pickup' ? 'bg-success' : 'bg-destructive'}`}>
                    {nextStop.stop_type === 'pickup' ? 'P' : 'D'}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Next Stop</p>
                    <p className="text-sm font-bold">{nextStop.stop_type === 'pickup' ? 'Pick Up' : 'Delivery'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Load #{nextStop.load?.reference_number}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{nextStop.address}</p>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextStop.address)}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Navigation className="h-4 w-4" /> Navigate
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-3 space-y-1">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" /> {a}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active Loads */}
        <div>
          <h2 className="text-base font-semibold mb-2">Active Loads</h2>
          {activeLoads.length === 0 ? (
            <p className="text-base text-muted-foreground">No active loads right now.</p>
          ) : (
            <div className="space-y-3">
              {activeLoads.map(load => (
                <Card key={load.id} className={`cursor-pointer hover:shadow-md transition-shadow border-l-[3px] ${statusBorderColor(load.status)}`} onClick={() => navigate(`/driver/loads/${load.id}`)}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold">Load #{load.reference_number}</span>
                      <Badge className={
                        load.status === 'in_transit' ? 'bg-info text-info-foreground' :
                        load.status === 'picked_up' ? 'bg-primary text-primary-foreground' :
                        load.status === 'on_site_pickup' || load.status === 'on_site_delivery' ? 'bg-warning text-warning-foreground' :
                        'bg-warning text-warning-foreground'
                      }>
                        {load.status === 'in_transit' ? 'In Transit' :
                         load.status === 'picked_up' ? 'Picked Up' :
                         load.status === 'on_site_pickup' ? 'On Site - Pickup' :
                         load.status === 'on_site_delivery' ? 'On Site - Delivery' :
                         'Dispatched'}
                      </Badge>
                    </div>

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

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="font-semibold text-primary">${Number(load.total_rate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RPM</span>
                        <span className="font-semibold">{Number(load.miles) > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—'}</span>
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

                    <LoadProgressBar status={load.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

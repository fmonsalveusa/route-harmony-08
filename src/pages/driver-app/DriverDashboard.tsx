import { useEffect, useState } from 'react';
import { Package, DollarSign, MapPin, AlertTriangle, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isPast, addDays } from 'date-fns';

export default function DriverDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<any>(null);
  const [activeLoads, setActiveLoads] = useState<any[]>([]);
  const [stats, setStats] = useState({ loadsMonth: 0, earningsMonth: 0 });

  useEffect(() => {
    if (!profile?.email) return;
    const fetch = async () => {
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

      // Stats
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const { data: monthLoads } = await supabase
        .from('loads')
        .select('id, total_rate')
        .eq('driver_id', d.id)
        .eq('status', 'delivered')
        .gte('delivery_date', startOfMonth.toISOString().split('T')[0]);
      const count = monthLoads?.length || 0;
      const earnings = monthLoads?.reduce((s, l) => s + Number(l.total_rate) * ((d.pay_percentage || 30) / 100), 0) || 0;
      setStats({ loadsMonth: count, earningsMonth: earnings });
    };
    fetch();
  }, [profile?.email]);

  const alerts: string[] = [];
  if (driver) {
    if (driver.license_expiry && isPast(addDays(new Date(driver.license_expiry), -30))) alerts.push(`License expires ${format(new Date(driver.license_expiry), 'MMM dd')}`);
    if (driver.medical_card_expiry && isPast(addDays(new Date(driver.medical_card_expiry), -30))) alerts.push(`Medical card expires ${format(new Date(driver.medical_card_expiry), 'MMM dd')}`);
  }

  return (
    <div className="p-5 space-y-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
      <div>
        <h1 className="text-2xl font-bold">Hello, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-base text-muted-foreground">Here's your overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <p className="text-sm font-medium text-muted-foreground">Loads this month</p>
            </div>
            <p className="text-2xl font-bold">{stats.loadsMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div>
              <p className="text-sm font-medium text-muted-foreground">Earnings this month</p>
            </div>
            <p className="text-2xl font-bold">${stats.earningsMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
      </div>

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
          <div className="space-y-2">
            {activeLoads.map(load => (
              <Card key={load.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/driver/loads/${load.id}`)}>
                <CardContent className="p-3 space-y-2">
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="truncate">{(() => { const p = load.origin?.split(',').map((s: string) => s.trim()); return p?.length >= 2 ? `${p[0]}, ${p[1]}` : load.origin; })()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span className="truncate">{(() => { const p = load.destination?.split(',').map((s: string) => s.trim()); return p?.length >= 2 ? `${p[0]}, ${p[1]}` : load.destination; })()}</span>
                    </div>
                  </div>
                  {load.broker_client && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Broker: </span>
                      <span className="font-medium">{load.broker_client}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Rate: </span>
                      <span className="font-semibold text-primary">${Number(load.total_rate).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">RPM: </span>
                      <span className="font-semibold">{Number(load.miles) > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—'}</span>
                    </div>
                  </div>
                  {load.delivery_date && (
                    <div className="text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />
                      Est. Delivery: <span className="font-medium text-foreground">{formatDate(load.delivery_date)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

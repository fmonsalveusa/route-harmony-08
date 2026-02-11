import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
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
      delivered: 'bg-success text-success-foreground',
      paid: 'bg-success text-success-foreground',
      pending: 'bg-muted text-muted-foreground',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const active = loads.filter(l => ['dispatched', 'in_transit'].includes(l.status));
  const completed = loads.filter(l => ['delivered', 'paid'].includes(l.status));

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const LoadCard = ({ load }: { load: any }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/driver/loads/${load.id}`)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold">{load.reference_number}</span>
          <Badge className={statusBadge(load.status)}>{load.status.replace('_', ' ')}</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{load.origin}</span>
          <span>→</span>
          <span className="truncate">{load.destination}</span>
        </div>
        <p className="text-xs font-semibold text-primary mt-1">${Number(load.total_rate).toLocaleString()}</p>
      </CardContent>
    </Card>
  );

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

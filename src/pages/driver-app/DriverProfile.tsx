import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, FileText, Truck, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function DriverProfile() {
  const { profile } = useAuth();
  const [driver, setDriver] = useState<any>(null);
  const [truck, setTruck] = useState<any>(null);

  useEffect(() => {
    if (!profile?.email) return;
    const fetch = async () => {
      const { data: d } = await supabase.from('drivers').select('*').eq('email', profile.email).maybeSingle();
      if (d) {
        setDriver(d);
        if (d.truck_id) {
          const { data: t } = await supabase.from('trucks').select('*').eq('id', d.truck_id).maybeSingle();
          if (t) setTruck(t);
        }
      }
    };
    fetch();
  }, [profile?.email]);

  if (!driver) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-base font-medium">{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-xl font-bold">My Profile</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow icon={User} label="Name" value={driver.name} />
          <InfoRow icon={Mail} label="Email" value={driver.email} />
          <InfoRow icon={Phone} label="Phone" value={driver.phone} />
          <InfoRow icon={FileText} label="License" value={driver.license} />
          <InfoRow icon={Calendar} label="License Expires" value={driver.license_expiry ? format(new Date(driver.license_expiry), 'MMM dd, yyyy') : '—'} />
          <InfoRow icon={Calendar} label="Medical Card Expires" value={driver.medical_card_expiry ? format(new Date(driver.medical_card_expiry), 'MMM dd, yyyy') : '—'} />
          <div className="flex items-center gap-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Service Type</p>
              <Badge variant="outline" className="text-xs">{driver.service_type?.replace('_', ' ')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {truck && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> My Truck</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow icon={Truck} label="Unit" value={truck.unit_number} />
            <InfoRow icon={Truck} label="Type" value={truck.truck_type} />
            <InfoRow icon={Truck} label="Make/Model" value={`${truck.make || ''} ${truck.model || ''}`.trim() || '—'} />
            <InfoRow icon={Calendar} label="Year" value={truck.year?.toString() || '—'} />
            <InfoRow icon={FileText} label="VIN" value={truck.vin || '—'} />
            <InfoRow icon={FileText} label="Plate" value={truck.license_plate || '—'} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

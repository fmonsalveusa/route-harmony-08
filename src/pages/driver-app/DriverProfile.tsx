import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, FileText, Truck, Calendar, Sun, Moon, Monitor, Palette } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { useTheme } from 'next-themes';

export default function DriverProfile() {
  const { profile } = useAuth();
  const [driver, setDriver] = useState<any>(null);
  const [truck, setTruck] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.email) return;
    const { data: d } = await supabase.from('drivers').select('*').eq('email', profile.email).maybeSingle();
    if (d) {
      setDriver(d);
      if (d.truck_id) {
        const { data: t } = await supabase.from('trucks').select('*').eq('id', d.truck_id).maybeSingle();
        if (t) setTruck(t);
      }
    }
  }, [profile?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!driver) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const initials = driver.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

  const ExpiryBadgeInline = ({ date }: { date: string | null }) => {
    if (!date) return <span className="text-muted-foreground">—</span>;
    const days = differenceInDays(new Date(date), new Date());
    const formatted = format(new Date(date), 'MMM dd, yyyy');
    if (days < 0) return <span className="text-destructive font-medium">{formatted} <Badge variant="destructive" className="ml-1 text-[10px]">Expired</Badge></span>;
    if (days < 7) return <span className="text-destructive font-medium">{formatted} <Badge variant="destructive" className="ml-1 text-[10px]">{days}d left</Badge></span>;
    if (days < 30) return <span className="text-warning font-medium">{formatted} <Badge className="ml-1 text-[10px] bg-warning text-warning-foreground">{days}d left</Badge></span>;
    return <span className="font-medium">{formatted}</span>;
  };

  const InfoRow = ({ icon: Icon, label, value, children }: { icon: any; label: string; value?: string; children?: React.ReactNode }) => (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children || <p className="text-base font-medium">{value || '—'}</p>}
      </div>
    </div>
  );

  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ] as const;

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="p-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] space-y-5">
        {/* Avatar Header */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground">
            {initials}
          </div>
          <h1 className="text-xl font-bold">{driver.name}</h1>
          <Badge variant="outline" className="text-xs">{driver.service_type?.replace('_', ' ')}</Badge>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow icon={Mail} label="Email" value={driver.email} />
            <InfoRow icon={Phone} label="Phone" value={driver.phone} />
            <InfoRow icon={FileText} label="License" value={driver.license} />
            <InfoRow icon={Calendar} label="License Expires">
              <ExpiryBadgeInline date={driver.license_expiry} />
            </InfoRow>
            <InfoRow icon={Calendar} label="Medical Card Expires">
              <ExpiryBadgeInline date={driver.medical_card_expiry} />
            </InfoRow>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {themeOptions.map(opt => {
                const active = (theme || 'system') === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                      active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <opt.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
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
    </PullToRefresh>
  );
}

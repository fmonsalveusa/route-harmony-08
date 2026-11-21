import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Mail, FileText, Truck, Calendar, IdCard, HeartPulse, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { ExpiryRing } from '@/components/detail/DetailTiles';
import { CARD } from '@/components/driver-app/driverUi';
import { PullToRefresh } from '@/components/driver-app/PullToRefresh';
import { useTheme } from 'next-themes';

export default function DriverProfile() {
  const { profile } = useAuth();
  const [driver, setDriver] = useState<any>(null);
  const [truck, setTruck] = useState<any>(null);

  // ⚠️ All hooks must be declared before any early return (Rules of Hooks)
  const { setTheme } = useTheme();

  // La app móvil siempre usa Light mode
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

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

  if (!driver) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[#d3e3fd] border-t-[#0b57d0]" /></div>;

  const initials = driver.name?.split(' ')?.map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

  const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => (
    <div className="flex items-center gap-4 px-4 py-3">
      <Icon className="h-5 w-5 text-[#444746] flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#444746]">{label}</p>
        <p className="text-sm text-[#1f1f1f] break-words">{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="px-4 pt-2 pb-[calc(24px+env(safe-area-inset-bottom,0px))] space-y-4">
        {/* Encabezado con avatar */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-[28px] font-normal bg-[#0b57d0] text-white">
            {initials}
          </div>
          <h1 className="text-[22px] leading-7 font-normal text-center">{driver.name}</h1>
          {driver.service_type && (
            <span className="px-3 h-7 inline-flex items-center rounded-full bg-[#e9eef6] text-[#444746] text-xs font-medium capitalize">
              {driver.service_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Vencimientos con anillo */}
        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">Expirations</h2>
          <div className={`${CARD} p-2 grid grid-cols-1 gap-1.5`}>
            <ExpiryRing lang="en" icon={IdCard} label="Driver license" date={driver.license_expiry} />
            <ExpiryRing lang="en" icon={HeartPulse} label="Medical card" date={driver.medical_card_expiry} />
            {truck && <ExpiryRing lang="en" icon={FileText} label={`Registration · Unit ${truck.unit_number}`} date={truck.registration_expiry} />}
            {truck && <ExpiryRing lang="en" icon={ShieldCheck} label="Truck insurance" date={truck.insurance_expiry} />}
            {truck && <ExpiryRing lang="en" icon={ClipboardCheck} label="Annual inspection" date={truck.annual_inspection_expiry} />}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">Personal info</h2>
          <div className={`${CARD} divide-y divide-[#f0f4f9]`}>
            <Row icon={Mail} label="Email" value={driver.email} />
            <Row icon={Phone} label="Phone" value={driver.phone} />
            <Row icon={FileText} label="License #" value={driver.license} />
          </div>
        </div>

        {truck && (
          <div>
            <h2 className="text-sm font-medium text-[#444746] px-1 mb-2">My truck</h2>
            <div className={`${CARD} divide-y divide-[#f0f4f9]`}>
              <Row icon={Truck} label="Unit" value={truck.unit_number} />
              <Row icon={Truck} label="Type" value={truck.truck_type} />
              <Row icon={Truck} label="Make / Model" value={`${truck.make || ''} ${truck.model || ''}`.trim()} />
              <Row icon={Calendar} label="Year" value={truck.year?.toString()} />
              <Row icon={FileText} label="VIN" value={truck.vin} />
              <Row icon={FileText} label="Plate" value={truck.license_plate} />
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  license: string;
  license_expiry: string | null;
  medical_card_expiry: string | null;
  status: string;
  dispatcher_id: string | null;
  truck_id: string | null;
  investor_name: string | null;
  pay_percentage: number;
  investor_pay_percentage: number | null;
  factoring_percentage: number;
  hire_date: string;
  loads_this_month: number;
  earnings_this_month: number;
  license_photo_url: string | null;
  medical_card_photo_url: string | null;
  form_w9_url: string | null;
  leasing_agreement_url: string | null;
  service_agreement_url: string | null;
  service_type: string;
  created_at: string;
  updated_at: string;
}

export interface DriverInput {
  name: string;
  email: string;
  phone: string;
  license: string;
  license_expiry?: string | null;
  medical_card_expiry?: string | null;
  status: string;
  service_type: string;
  dispatcher_id?: string | null;
  truck_id?: string | null;
  investor_name?: string | null;
  pay_percentage: number;
  investor_pay_percentage?: number | null;
  factoring_percentage?: number;
  hire_date: string;
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<DbDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('drivers' as any).select('*').order('name');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDrivers((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  // Realtime: auto-refresh when drivers table changes
  useEffect(() => {
    const channel = supabase
      .channel('drivers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDrivers]);

  const createDriver = async (input: DriverInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('drivers' as any).insert({ ...input, tenant_id } as any);
    if (error) {
      toast({ title: 'Error creating driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver created successfully' });
    fetchDrivers();
    return true;
  };

  const updateDriver = async (id: string, input: Partial<DriverInput> & Record<string, any>) => {
    const { error } = await supabase.from('drivers' as any).update(input as any).eq('id', id);
    if (error) {
      toast({ title: 'Error updating driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver updated successfully' });
    fetchDrivers();
    return true;
  };

  const deleteDriver = async (id: string) => {
    const { error } = await supabase.from('drivers' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver deleted successfully' });
    fetchDrivers();
    return true;
  };

  const uploadDocument = async (file: File, driverId: string, docType: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${driverId}/${docType}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-documents').upload(path, file);
    if (error) {
      toast({ title: 'Error uploading document', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
    return urlData?.signedUrl || null;
  };

  return { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument, refetch: fetchDrivers };
}

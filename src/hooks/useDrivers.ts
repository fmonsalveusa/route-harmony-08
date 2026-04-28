import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  dispatch_service_percentage: number;
  state: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  birthday: string | null;
  emergency_contact_name: string | null;
  emergency_phone: string | null;
  investor_email: string | null;
  investor_id: string | null;
  manual_location_address: string | null;
  manual_location_lat: number | null;
  manual_location_lng: number | null;
  termination_letter_url: string | null;
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
  investor_email?: string | null;
  investor_id?: string | null;
  pay_percentage: number;
  investor_pay_percentage?: number | null;
  factoring_percentage?: number;
  dispatch_service_percentage?: number;
  hire_date: string;
  state?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  birthday?: string | null;
  emergency_contact_name?: string | null;
  emergency_phone?: string | null;
}

const DRIVERS_QUERY_KEY = ['drivers'];

async function fetchDriversFromDb(): Promise<DbDriver[]> {
  const { data, error } = await supabase.from('drivers' as any).select('*').order('name');
  if (error) throw error;
  return (data as any) || [];
}

export function useDrivers() {
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading: loading } = useQuery({
    queryKey: DRIVERS_QUERY_KEY,
    queryFn: fetchDriversFromDb,
    staleTime: 5 * 60 * 1000, // cache 5 minutos — drivers no cambian frecuentemente
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
  }, [queryClient]);

  const createDriver = async (input: DriverInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('drivers' as any).insert({ ...input, tenant_id } as any);
    if (error) {
      toast({ title: 'Error creating driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver created successfully' });
    await queryClient.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
    return true;
  };

  const updateDriver = async (id: string, input: Partial<DriverInput> & Record<string, any>) => {
    const { error } = await supabase.from('drivers' as any).update(input as any).eq('id', id);
    if (error) {
      toast({ title: 'Error updating driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver updated successfully' });
    await queryClient.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
    return true;
  };

  const deleteDriver = async (id: string) => {
    const { error } = await supabase.from('drivers' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting driver', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Driver deleted successfully' });
    await queryClient.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
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

  const getDocSignedUrl = async (storedUrl: string): Promise<string | null> => {
    try {
      const match = storedUrl.match(/\/driver-documents\/([^?]+)/);
      let path: string;
      if (match) {
        path = decodeURIComponent(match[1]);
      } else if (storedUrl.startsWith('http')) {
        return storedUrl;
      } else {
        path = storedUrl;
      }
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
      return data?.signedUrl || storedUrl;
    } catch {
      return storedUrl;
    }
  };

  const createDriversBulk = async (inputs: DriverInput[]): Promise<{ success: number; errors: number }> => {
    const tenant_id = await getTenantId();
    const records = inputs.map(input => ({ ...input, tenant_id }));
    const { data, error } = await supabase.from('drivers' as any).insert(records as any).select();
    if (error) {
      toast({ title: 'Bulk import error', description: error.message, variant: 'destructive' });
      return { success: 0, errors: inputs.length };
    }
    const count = (data as any[])?.length || 0;
    await queryClient.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY });
    return { success: count, errors: inputs.length - count };
  };

  return { drivers, loading, createDriver, createDriversBulk, updateDriver, deleteDriver, uploadDocument, getDocSignedUrl, refetch };
}

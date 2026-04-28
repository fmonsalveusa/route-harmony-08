import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbTruck {
  id: string;
  unit_number: string;
  truck_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  max_payload_lbs: number | null;
  vin: string | null;
  license_plate: string | null;
  status: string;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  registration_photo_url: string | null;
  insurance_photo_url: string | null;
  license_photo_url: string | null;
  rear_truck_photo_url: string | null;
  truck_side_photo_url: string | null;
  truck_plate_photo_url: string | null;
  cargo_area_photo_url: string | null;
  driver_id: string | null;
  investor_id: string | null;
  cargo_length_ft: number | null;
  cargo_width_in: number | null;
  cargo_height_in: number | null;
  rear_door_width_in: number | null;
  rear_door_height_in: number | null;
  trailer_length_ft: number | null;
  mega_ramp: string | null;
  created_at: string;
  updated_at: string;
}

export interface TruckInput {
  unit_number: string;
  truck_type: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  max_payload_lbs?: number | null;
  vin?: string | null;
  license_plate?: string | null;
  status: string;
  insurance_expiry?: string | null;
  registration_expiry?: string | null;
  driver_id?: string | null;
  investor_id?: string | null;
  cargo_length_ft?: number | null;
  cargo_width_in?: number | null;
  cargo_height_in?: number | null;
  rear_door_width_in?: number | null;
  rear_door_height_in?: number | null;
  trailer_length_ft?: number | null;
  mega_ramp?: string | null;
}

const TRUCKS_QUERY_KEY = ['trucks'];

async function fetchTrucksFromDb(): Promise<DbTruck[]> {
  const { data, error } = await supabase.from('trucks' as any).select('*').order('unit_number');
  if (error) throw error;
  return (data as any) || [];
}

export function useTrucks() {
  const queryClient = useQueryClient();

  const { data: trucks = [], isLoading: loading } = useQuery({
    queryKey: TRUCKS_QUERY_KEY,
    queryFn: fetchTrucksFromDb,
    staleTime: 5 * 60 * 1000, // cache 5 minutos
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: TRUCKS_QUERY_KEY });
  }, [queryClient]);

  const createTruck = async (input: TruckInput) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('trucks' as any).insert({ ...input, tenant_id } as any);
    if (error) {
      toast({ title: 'Error creating truck', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Truck created successfully' });
    await queryClient.invalidateQueries({ queryKey: TRUCKS_QUERY_KEY });
    return true;
  };

  const updateTruck = async (id: string, input: Partial<TruckInput> & Record<string, any>) => {
    const { error } = await supabase.from('trucks' as any).update(input as any).eq('id', id);
    if (error) {
      toast({ title: 'Error updating truck', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Truck updated successfully' });
    await queryClient.invalidateQueries({ queryKey: TRUCKS_QUERY_KEY });
    return true;
  };

  const deleteTruck = async (id: string) => {
    const { error } = await supabase.from('trucks' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting truck', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Truck deleted successfully' });
    await queryClient.invalidateQueries({ queryKey: TRUCKS_QUERY_KEY });
    return true;
  };

  const uploadDocument = async (file: File, truckId: string, docType: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `trucks/${truckId}/${docType}_${Date.now()}.${ext}`;
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

  return { trucks, loading, createTruck, updateTruck, deleteTruck, uploadDocument, getDocSignedUrl, refetch };
}

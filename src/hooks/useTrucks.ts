import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

export function useTrucks() {
  const [trucks, setTrucks] = useState<DbTruck[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('trucks' as any).select('*').order('unit_number');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTrucks((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrucks(); }, [fetchTrucks]);

  const createTruck = async (input: TruckInput) => {
    const { error } = await supabase.from('trucks' as any).insert(input as any);
    if (error) {
      toast({ title: 'Error al crear camión', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Camión creado exitosamente' });
    fetchTrucks();
    return true;
  };

  const updateTruck = async (id: string, input: Partial<TruckInput> & Record<string, any>) => {
    const { error } = await supabase.from('trucks' as any).update(input as any).eq('id', id);
    if (error) {
      toast({ title: 'Error al actualizar camión', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Camión actualizado exitosamente' });
    fetchTrucks();
    return true;
  };

  const deleteTruck = async (id: string) => {
    const { error } = await supabase.from('trucks' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error al eliminar camión', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Camión eliminado exitosamente' });
    fetchTrucks();
    return true;
  };

  const uploadDocument = async (file: File, truckId: string, docType: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `trucks/${truckId}/${docType}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-documents').upload(path, file);
    if (error) {
      toast({ title: 'Error al subir documento', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path);
    return urlData.publicUrl;
  };

  return { trucks, loading, createTruck, updateTruck, deleteTruck, uploadDocument, refetch: fetchTrucks };
}

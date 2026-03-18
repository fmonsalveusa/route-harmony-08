import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface EldAccount {
  id: string;
  tenant_id: string;
  provider: string;
  api_user: string;
  api_password_encrypted: string;
  company_id: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface EldVehicleMap {
  id: string;
  tenant_id: string;
  eld_account_id: string;
  eld_vehicle_id: string;
  eld_vehicle_name: string | null;
  driver_id: string | null;
  truck_id: string | null;
  is_active: boolean;
}

export function useEldAccounts() {
  const [accounts, setAccounts] = useState<EldAccount[]>([]);
  const [vehicleMaps, setVehicleMaps] = useState<EldVehicleMap[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('eld_accounts' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setAccounts((data as any) || []);
  }, []);

  const fetchVehicleMaps = useCallback(async () => {
    const { data, error } = await supabase
      .from('eld_vehicle_map' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setVehicleMaps((data as any) || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchAccounts(), fetchVehicleMaps()]).finally(() => setLoading(false));
  }, [fetchAccounts, fetchVehicleMaps]);

  const createAccount = useCallback(async (input: { api_user: string; api_password: string; company_id: string }) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('eld_accounts' as any).insert({
      tenant_id,
      api_user: input.api_user,
      api_password_encrypted: input.api_password,
      company_id: input.company_id,
    } as any);
    if (error) { toast({ title: 'Error creating ELD account', variant: 'destructive' }); return; }
    toast({ title: 'ELD account created' });
    fetchAccounts();
  }, [fetchAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase.from('eld_accounts' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error deleting', variant: 'destructive' }); return; }
    toast({ title: 'ELD account deleted' });
    fetchAccounts();
    fetchVehicleMaps();
  }, [fetchAccounts, fetchVehicleMaps]);

  const toggleAccount = useCallback(async (id: string, is_active: boolean) => {
    await supabase.from('eld_accounts' as any).update({ is_active } as any).eq('id', id);
    fetchAccounts();
  }, [fetchAccounts]);

  const testConnection = useCallback(async (accountId: string) => {
    // Trigger a manual sync via the edge function
    const { data, error } = await supabase.functions.invoke('eld-sync');
    if (error) {
      toast({ title: 'Connection test failed', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Connection test successful' });
    fetchAccounts();
    return true;
  }, [fetchAccounts]);

  const fetchRemoteVehicles = useCallback(async (accountId: string): Promise<{ vehicleId: string; name: string }[]> => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return [];

    try {
      // Call HOSconnect via a proxy edge function would be ideal,
      // but for now we'll fetch vehicles through the eld-sync function
      // The admin will manually add vehicle mappings
      toast({ title: 'Use the form below to add vehicle mappings manually' });
      return [];
    } catch {
      return [];
    }
  }, [accounts]);

  const createVehicleMap = useCallback(async (input: {
    eld_account_id: string;
    eld_vehicle_id: string;
    eld_vehicle_name?: string;
    driver_id?: string;
    truck_id?: string;
  }) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('eld_vehicle_map' as any).insert({
      tenant_id,
      ...input,
    } as any);
    if (error) { toast({ title: 'Error creating mapping', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Vehicle mapping created' });
    fetchVehicleMaps();
  }, [fetchVehicleMaps]);

  const deleteVehicleMap = useCallback(async (id: string) => {
    await supabase.from('eld_vehicle_map' as any).delete().eq('id', id);
    toast({ title: 'Mapping deleted' });
    fetchVehicleMaps();
  }, [fetchVehicleMaps]);

  const triggerSync = useCallback(async () => {
    toast({ title: 'Syncing...' });
    const { error } = await supabase.functions.invoke('eld-sync');
    if (error) {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sync completed' });
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts, vehicleMaps, loading,
    createAccount, deleteAccount, toggleAccount, testConnection,
    createVehicleMap, deleteVehicleMap, fetchRemoteVehicles, triggerSync,
  };
}

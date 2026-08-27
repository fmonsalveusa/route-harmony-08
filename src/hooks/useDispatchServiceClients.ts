import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { useToast } from '@/hooks/use-toast';

export interface DispatchServiceClient {
  id: string;
  tenant_id: string;
  legal_business_name: string;
  dba: string | null;
  mc_number: string | null;
  dot_number: string | null;
  ein: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  email_password: string | null;
  owner_full_name: string | null;
  factoring_company_name: string | null;
  factoring_username: string | null;
  factoring_password: string | null;
  insurance_company_name: string | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  insurance_cert_url: string | null;
  mc_authority_url: string | null;
  noa_url: string | null;
  dispatch_service_agreement_url: string | null;
  agreement_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateDispatchServiceClientInput = Partial<Omit<DispatchServiceClient, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>> & {
  legal_business_name: string;
};

export function useDispatchServiceClients() {
  const [clients, setClients] = useState<DispatchServiceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dispatch_service_clients' as any)
      .select('*')
      .order('legal_business_name');
    if (error) {
      console.error('[useDispatchServiceClients] fetch error:', error);
      toast({ title: 'Error cargando clients', description: error.message, variant: 'destructive' });
    } else {
      setClients((data as any) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const createClient = useCallback(async (input: CreateDispatchServiceClientInput): Promise<DispatchServiceClient | null> => {
    const tenant_id = await getTenantId();
    if (!tenant_id) {
      toast({ title: 'Error', description: 'No tenant', variant: 'destructive' });
      return null;
    }
    const { data, error } = await supabase
      .from('dispatch_service_clients' as any)
      .insert({ ...input, tenant_id } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error creando client', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchClients();
    return data as any;
  }, [fetchClients, toast]);

  const updateClient = useCallback(async (id: string, updates: Partial<DispatchServiceClient>): Promise<boolean> => {
    const { error } = await supabase
      .from('dispatch_service_clients' as any)
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error actualizando client', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchClients();
    return true;
  }, [fetchClients, toast]);

  const deleteClient = useCallback(async (id: string): Promise<boolean> => {
    const { data: deleted, error } = await supabase
      .from('dispatch_service_clients' as any)
      .delete()
      .eq('id', id)
      .select();
    if (error) {
      toast({ title: 'Error borrando client', description: error.message, variant: 'destructive' });
      return false;
    }
    if (!deleted || (deleted as any[]).length === 0) {
      toast({ title: 'No se pudo borrar', description: 'RLS bloqueo la operacion.', variant: 'destructive' });
      return false;
    }
    await fetchClients();
    return true;
  }, [fetchClients, toast]);

  return { clients, loading, createClient, updateClient, deleteClient, refetch: fetchClients };
}

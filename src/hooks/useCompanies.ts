import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getTenantId } from '@/hooks/useTenantId';

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  mc_number: string | null;
  dot_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  is_primary: boolean;
  leasing_agreement_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    const { data, error } = await supabase.from('companies').select('*').order('name');
    if (error) { toast.error('Error loading companies'); return; }
    setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const createCompany = async (company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase.from('companies').insert({ ...company, tenant_id } as any);
    if (error) { toast.error('Error creating company'); return; }
    toast.success('Company created');
    fetchCompanies();
  };

  const updateCompany = async (id: string, updates: Partial<Company>) => {
    const { error } = await supabase.from('companies').update(updates).eq('id', id);
    if (error) { toast.error('Error updating company'); return; }
    toast.success('Company updated');
    fetchCompanies();
  };

  const setPrimaryCompany = async (id: string) => {
    const { error } = await supabase.from('companies').update({ is_primary: true } as any).eq('id', id);
    if (error) { toast.error('Error setting primary company'); return; }
    toast.success('Primary company updated');
    fetchCompanies();
  };

  const deleteCompany = async (id: string) => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) { toast.error('Error deleting company'); return; }
    toast.success('Company deleted');
    fetchCompanies();
  };

  return { companies, loading, createCompany, updateCompany, deleteCompany, setPrimaryCompany, refetch: fetchCompanies };
}

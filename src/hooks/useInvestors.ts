import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbInvestor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  pay_percentage: number;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  // Address
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Business
  business_name: string | null;
  ein: string | null;
  ssn_last4: string | null;
  // Banking
  bank_name: string | null;
  account_holder_name: string | null;
  routing_number: string | null;
  account_number: string | null;
  account_type: string | null;
  // Documents
  w9_url: string | null;
  service_agreement_url: string | null;
  leasing_agreement_url: string | null;
}

export interface InvestorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  pay_percentage: number;
  // Address
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  // Business
  business_name?: string | null;
  ein?: string | null;
  ssn_last4?: string | null;
  // Banking
  bank_name?: string | null;
  account_holder_name?: string | null;
  routing_number?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  // Documents
  w9_url?: string | null;
  service_agreement_url?: string | null;
  leasing_agreement_url?: string | null;
}

export function useInvestors() {
  const [investors, setInvestors] = useState<DbInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('investors' as any)
      .select('*')
      .order('name');
    if (error) {
      toastRef.current({ title: 'Error loading investors', description: error.message, variant: 'destructive' });
    } else {
      setInvestors((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('investors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, () => {
        fetchInvestors();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInvestors]);

  const createInvestor = useCallback(async (input: InvestorInput): Promise<DbInvestor | null> => {
    const tenant_id = await getTenantId();
    const { data, error } = await supabase
      .from('investors' as any)
      .insert({ ...input, tenant_id } as any)
      .select()
      .single();
    if (error) {
      toastRef.current({ title: 'Error creating investor', description: error.message, variant: 'destructive' });
      return null;
    }
    toastRef.current({ title: 'Investor created', description: input.name });
    setInvestors(prev => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
    return data as any;
  }, []);

  const updateInvestor = useCallback(async (id: string, input: Partial<InvestorInput>): Promise<boolean> => {
    const { error } = await supabase
      .from('investors' as any)
      .update(input as any)
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error updating investor', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Investor updated' });
    setInvestors(prev =>
      prev.map(inv => inv.id === id ? { ...inv, ...input } : inv)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    return true;
  }, []);

  const deleteInvestor = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('investors' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error deleting investor', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Investor deleted' });
    setInvestors(prev => prev.filter(inv => inv.id !== id));
    return true;
  }, []);

  const uploadDocument = useCallback(async (file: File, investorId: string, docType: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `investors/${investorId}/${docType}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-documents').upload(path, file);
    if (error) {
      toastRef.current({ title: 'Error uploading document', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
    return urlData?.signedUrl || null;
  }, []);

  const getDocSignedUrl = useCallback(async (storedUrl: string): Promise<string | null> => {
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
  }, []);

  return { investors, loading, createInvestor, updateInvestor, deleteInvestor, refetch: fetchInvestors, uploadDocument, getDocSignedUrl };
}

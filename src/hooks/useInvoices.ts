import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getTenantId } from '@/hooks/useTenantId';

export interface Invoice {
  id: string;
  load_id: string;
  invoice_number: string;
  broker_name: string;
  company_id: string | null;
  company_name: string | null;
  amount: number;
  status: string;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Error loading invoices'); return; }
    setInvoices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const createInvoice = async (invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>) => {
    const tenant_id = await getTenantId();
    const { data, error } = await supabase.from('invoices').insert({ ...invoice, tenant_id } as any).select().maybeSingle();
    if (error) { toast.error('Error creating invoice'); return null; }
    toast.success('Invoice generado');
    fetchInvoices();
    return data;
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) { toast.error('Error updating invoice'); return; }
    fetchInvoices();
  };

  const deleteInvoice = async (id: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) { toast.error('Error deleting invoice'); return; }
    toast.success('Invoice eliminado');
    fetchInvoices();
  };

  return { invoices, loading, createInvoice, updateInvoice, deleteInvoice, refetch: fetchInvoices };
}

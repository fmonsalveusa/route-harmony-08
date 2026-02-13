import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getTenantId } from '@/hooks/useTenantId';

export interface DSInvoice {
  id: string;
  driver_id: string;
  driver_name: string;
  invoice_number: string;
  loads: any[];
  total_amount: number;
  percentage_applied: number;
  status: string;
  notes: string | null;
  period_from: string | null;
  period_to: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useDispatchServiceInvoices() {
  const [invoices, setInvoices] = useState<DSInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from('dispatch_service_invoices' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Error loading DS invoices'); return; }
    setInvoices((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .from('dispatch_service_invoices' as any)
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);
    const last = (data as any)?.[0]?.invoice_number;
    if (last) {
      const num = parseInt(last.replace('DSI-', ''), 10);
      return `DSI-${String((num || 0) + 1).padStart(4, '0')}`;
    }
    return 'DSI-0001';
  }, []);

  const createInvoice = async (input: Omit<DSInvoice, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => {
    const tenant_id = await getTenantId();
    const { error } = await supabase
      .from('dispatch_service_invoices' as any)
      .insert({ ...input, tenant_id } as any);
    if (error) { toast.error('Error creating DS invoice'); return false; }
    toast.success('Factura DS creada exitosamente');
    fetchInvoices();
    return true;
  };

  const updateInvoice = async (id: string, updates: Partial<DSInvoice>) => {
    const { error } = await supabase
      .from('dispatch_service_invoices' as any)
      .update(updates as any)
      .eq('id', id);
    if (error) { toast.error('Error updating DS invoice'); return; }
    fetchInvoices();
  };

  const deleteInvoice = async (id: string) => {
    const { error } = await supabase
      .from('dispatch_service_invoices' as any)
      .delete()
      .eq('id', id);
    if (error) { toast.error('Error deleting DS invoice'); return; }
    toast.success('Factura DS eliminada');
    fetchInvoices();
  };

  return { invoices, loading, getNextInvoiceNumber, createInvoice, updateInvoice, deleteInvoice, refetch: fetchInvoices };
}

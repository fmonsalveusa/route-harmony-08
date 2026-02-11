import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DriverPayment {
  id: string;
  load_id: string;
  load_reference: string;
  amount: number;
  percentage_applied: number;
  total_rate: number;
  status: string;
  payment_date: string | null;
  created_at: string;
}

export function useDriverPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!profile?.email) return;
    setLoading(true);

    // Find driver record by email
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('email', profile.email)
      .maybeSingle();

    if (!driver) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('recipient_id', driver.id)
      .eq('recipient_type', 'driver')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPayments(data as any);
    }
    setLoading(false);
  }, [profile?.email]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return { payments, loading, totalPending, totalPaid, refetch: fetchPayments };
}

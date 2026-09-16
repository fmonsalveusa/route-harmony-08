import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface TenantSettings {
  diesel_price_per_gallon: number;
  working_days_per_month: number;
}

const DEFAULTS: TenantSettings = {
  diesel_price_per_gallon: 3.85,
  working_days_per_month: 21,
};

const QUERY_KEY = ['tenant_settings'];

async function fetchSettings(): Promise<TenantSettings> {
  const tenant_id = await getTenantId();
  if (!tenant_id) return DEFAULTS;
  const { data } = await supabase
    .from('tenants' as any)
    .select('diesel_price_per_gallon, working_days_per_month')
    .eq('id', tenant_id)
    .maybeSingle();
  const row = data as any;
  return {
    diesel_price_per_gallon: Number(row?.diesel_price_per_gallon) || DEFAULTS.diesel_price_per_gallon,
    working_days_per_month: Number(row?.working_days_per_month) || DEFAULTS.working_days_per_month,
  };
}

export function useTenantSettings() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const { data: settings = DEFAULTS, isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const updateSettings = useCallback(async (input: Partial<TenantSettings>) => {
    const tenant_id = await getTenantId();
    if (!tenant_id) return false;
    const { error } = await supabase
      .from('tenants' as any)
      .update(input as any)
      .eq('id', tenant_id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toastRef.current({ title: 'Settings updated' });
    return true;
  }, [queryClient]);

  return { settings, loading, updateSettings };
}

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export type DieselRegion = 'national' | 'lower_atlantic';

export const DIESEL_REGION_LABELS: Record<DieselRegion, string> = {
  national: 'Nacional',
  lower_atlantic: 'Lower Atlantic',
};

export interface TenantSettings {
  diesel_price_per_gallon: number;
  working_days_per_month: number;
  diesel_price_region: DieselRegion;
  diesel_price_source: 'eia' | 'manual';
  diesel_price_updated_at: string | null;
}

const DEFAULTS: TenantSettings = {
  diesel_price_per_gallon: 3.85,
  working_days_per_month: 21,
  diesel_price_region: 'lower_atlantic',
  diesel_price_source: 'manual',
  diesel_price_updated_at: null,
};

const QUERY_KEY = ['tenant_settings'];

async function fetchSettings(): Promise<TenantSettings> {
  const tenant_id = await getTenantId();
  if (!tenant_id) return DEFAULTS;
  // select('*') para no romper si alguna columna todavía no existe
  const { data } = await supabase
    .from('tenants' as any)
    .select('*')
    .eq('id', tenant_id)
    .maybeSingle();
  const row = data as any;
  return {
    diesel_price_per_gallon: Number(row?.diesel_price_per_gallon) || DEFAULTS.diesel_price_per_gallon,
    working_days_per_month: Number(row?.working_days_per_month) || DEFAULTS.working_days_per_month,
    diesel_price_region: row?.diesel_price_region === 'national' ? 'national' : 'lower_atlantic',
    diesel_price_source: row?.diesel_price_source === 'eia' ? 'eia' : 'manual',
    diesel_price_updated_at: row?.diesel_price_updated_at ?? null,
  };
}

export function useTenantSettings() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: settings = DEFAULTS, isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const updateSettings = useCallback(async (input: Partial<TenantSettings>, silent = false) => {
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
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    if (!silent) toastRef.current({ title: 'Settings updated' });
    return true;
  }, [queryClient]);

  /** Precio manual — queda marcado como manual hasta la próxima actualización de EIA */
  const setManualDieselPrice = useCallback((price: number) => {
    return updateSettings({
      diesel_price_per_gallon: price,
      diesel_price_source: 'manual',
      diesel_price_updated_at: new Date().toISOString().split('T')[0],
    });
  }, [updateSettings]);

  /** Trae el último precio de EIA ahora mismo */
  const refreshDieselPrice = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-diesel-price', { body: {} });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Error');
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toastRef.current({ title: 'Precio del diésel actualizado desde EIA' });
      return true;
    } catch (e: any) {
      toastRef.current({ title: 'No se pudo actualizar el diésel', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { settings, loading, refreshing, updateSettings, setManualDieselPrice, refreshDieselPrice };
}

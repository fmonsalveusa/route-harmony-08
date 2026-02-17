import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbServiceLog {
  id: string;
  maintenance_id: string;
  tenant_id: string | null;
  performed_at: string;
  odometer_miles: number;
  cost: number | null;
  vendor: string | null;
  expense_id: string | null;
  notes: string | null;
  created_at: string;
}

export function useServiceLog(maintenanceId: string | null) {
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['service_log', maintenanceId],
    queryFn: async (): Promise<DbServiceLog[]> => {
      if (!maintenanceId) return [];
      const { data, error } = await supabase
        .from('maintenance_service_log' as any)
        .select('*')
        .eq('maintenance_id', maintenanceId)
        .order('performed_at', { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
    enabled: !!maintenanceId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['service_log', maintenanceId] });

  return { logs, isLoading, invalidate };
}

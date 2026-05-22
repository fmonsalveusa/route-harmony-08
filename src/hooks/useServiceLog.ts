import { useQuery, useQueryClient, useCallback } from '@tanstack/react-query';
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
  invoice_photo_url: string | null;
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

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['service_log', maintenanceId] }), [qc, maintenanceId]);

  const deleteLog = useCallback(async (logId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('maintenance_service_log' as any)
      .delete()
      .eq('id', logId);
    if (error) { console.error(error); return false; }
    invalidate();
    return true;
  }, [invalidate]);

  const updateLog = useCallback(async (logId: string, updates: Partial<Pick<DbServiceLog, 'performed_at' | 'odometer_miles' | 'cost' | 'vendor' | 'notes' | 'invoice_photo_url'>>): Promise<boolean> => {
    const { error } = await supabase
      .from('maintenance_service_log' as any)
      .update(updates as any)
      .eq('id', logId);
    if (error) { console.error(error); return false; }
    invalidate();
    return true;
  }, [invalidate]);

  return { logs, isLoading, invalidate, deleteLog, updateLog };
}

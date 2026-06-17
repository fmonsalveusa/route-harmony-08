import { useCallback } from 'react';
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
    if (!maintenanceId) return false;

    // 1. Obtener el log que vamos a borrar
    const logToDelete = logs.find(l => l.id === logId);
    if (!logToDelete) return false;

    // 2. Borrar el log
    const { error } = await supabase
      .from('maintenance_service_log' as any)
      .delete()
      .eq('id', logId);
    if (error) { console.error(error); return false; }

    // 3. Buscar el log anterior (el más reciente después de borrar este)
    const { data: remaining } = await supabase
      .from('maintenance_service_log' as any)
      .select('*')
      .eq('maintenance_id', maintenanceId)
      .order('performed_at', { ascending: false })
      .limit(1);

    const previousLog = remaining?.[0] as any;

    // 4. Obtener el intervalo de millas del mantenimiento
    const { data: maintenance } = await supabase
      .from('truck_maintenance' as any)
      .select('interval_miles, interval_days')
      .eq('id', maintenanceId)
      .maybeSingle();

    const intervalMiles = (maintenance as any)?.interval_miles || null;
    const intervalDays = (maintenance as any)?.interval_days || null;

    if (previousLog) {
      // Restaurar al log anterior
      const prevOdometer = Number(previousLog.odometer_miles) || 0;
      const prevDate = previousLog.performed_at;
      const nextDueMiles = intervalMiles ? prevOdometer + intervalMiles : null;
      const nextDueDate = intervalDays
        ? new Date(new Date(prevDate).getTime() + intervalDays * 86400000).toISOString().split('T')[0]
        : null;

      await supabase.from('truck_maintenance' as any)
        .update({
          last_performed_at: prevDate,
          last_miles: prevOdometer,
          next_due_miles: nextDueMiles,
          next_due_date: nextDueDate,
          miles_accumulated: 0,
          miles_carried_forward: 0,
          status: 'ok',
        } as any)
        .eq('id', maintenanceId);

      console.log(`[deleteLog] Restaurado a log anterior: ${prevDate}, ${prevOdometer} mi`);
    } else {
      // No hay log anterior — resetear a estado inicial
      await supabase.from('truck_maintenance' as any)
        .update({
          last_performed_at: new Date().toISOString().split('T')[0],
          last_miles: 0,
          next_due_miles: intervalMiles || null,
          next_due_date: null,
          miles_accumulated: 0,
          miles_carried_forward: 0,
          status: 'ok',
        } as any)
        .eq('id', maintenanceId);

      console.log(`[deleteLog] Sin log anterior — reset a estado inicial`);
    }

    invalidate();
    qc.invalidateQueries({ queryKey: ['truck_maintenance'] });
    return true;
  }, [logs, maintenanceId, invalidate, qc]);

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

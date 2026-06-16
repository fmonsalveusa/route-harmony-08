import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

async function runMaintenanceCheck() {
  // Verificar que hay sesion activa antes de correr
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: items, error } = await supabase
    .from('truck_maintenance' as any)
    .select('*')
    .or('interval_miles.not.is.null,interval_days.not.is.null');

  if (error || !items?.length) return;

  const truckIds = [...new Set((items as any[]).map((m: any) => m.truck_id))];

  for (const truckId of truckIds) {
    const truckItems = (items as any[]).filter((m: any) => m.truck_id === truckId);

    for (const item of truckItems) {
      // Sumar millas acumuladas desde el último servicio
      const { data: loads } = await supabase
        .from('loads' as any)
        .select('miles, empty_miles')
        .eq('truck_id', truckId)
        .gte('pickup_date', item.last_performed_at)
        .in('status', ['in_transit', 'picked_up', 'on_site_delivery', 'delivered', 'paid']);

      const miles_accumulated = ((loads as any[]) || []).reduce(
        (sum: number, l: any) => sum + (Number(l.miles) || 0) + (Number(l.empty_miles) || 0),
        0
      );

      // Status por millas
      let milesStatus = 'ok';
      if (item.interval_miles && item.interval_miles > 0) {
        const pct = miles_accumulated / item.interval_miles;
        if (pct >= 1) milesStatus = 'due';
        else if (pct >= 0.8) milesStatus = 'warning';
      }

      // Status por fecha
      let dateStatus = 'ok';
      if (item.next_due_date) {
        const daysUntil = (new Date(item.next_due_date).getTime() - Date.now()) / 86400000;
        if (daysUntil <= 0) dateStatus = 'due';
        else if (daysUntil <= 30) dateStatus = 'warning';
      }

      const statusOrder = { ok: 0, warning: 1, due: 2 };
      const finalStatus =
        (statusOrder[dateStatus as keyof typeof statusOrder] || 0) >=
        (statusOrder[milesStatus as keyof typeof statusOrder] || 0)
          ? dateStatus
          : milesStatus;

      const oldStatus = item.status;

      // Actualizar DB
      await supabase
        .from('truck_maintenance' as any)
        .update({ miles_accumulated, status: finalStatus } as any)
        .eq('id', item.id);

      // Notificar solo si el status empeoró
      if (
        finalStatus !== oldStatus &&
        (finalStatus === 'warning' || finalStatus === 'due')
      ) {
        const tenant_id = await getTenantId();
        const label = finalStatus === 'due' ? '⚠️ OVERDUE' : '⚡ Approaching Due';
        await supabase.from('notifications' as any).insert({
          tenant_id,
          title: `Maintenance ${label}`,
          message: `${item.maintenance_type} is ${
            finalStatus === 'due' ? 'overdue' : 'approaching due date'
          }. ${miles_accumulated.toLocaleString()} mi accumulated.`,
          type: 'maintenance',
        } as any);
      }
    }
  }
}

function msUntilNext8am(): number {
  const now = new Date();
  const next8am = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8, 0, 0, 0
  );
  // Si ya pasaron las 8am de hoy, apunta al día siguiente
  if (now >= next8am) next8am.setDate(next8am.getDate() + 1);
  return next8am.getTime() - now.getTime();
}

export function useMaintenanceAutoCheck() {
  const qc = useQueryClient();
  const ranOnce = useRef(false);
  const dailyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = async () => {
    console.log('[MaintenanceAutoCheck] Running check...');
    await runMaintenanceCheck();
    console.log('[MaintenanceAutoCheck] Done.');
    qc.invalidateQueries({ queryKey: ['truck_maintenance'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const scheduleDailyCheck = () => {
    const ms = msUntilNext8am();
    dailyTimer.current = setTimeout(() => {
      check();
      // Después del primer disparo, repetir cada 24h exactas
      dailyTimer.current = setInterval(check, 24 * 60 * 60 * 1000);
    }, ms);
  };

  useEffect(() => {
    // Correr una vez al montar (al abrir/recargar la app)
    if (!ranOnce.current) {
      ranOnce.current = true;
      check();
    }

    // Programar el check diario a las 8:00am
    scheduleDailyCheck();

    return () => {
      if (dailyTimer.current) clearTimeout(dailyTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

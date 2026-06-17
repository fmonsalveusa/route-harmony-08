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

      // Notificar si el status es warning o due (todos los dias mientras persista)
      if (finalStatus === 'warning' || finalStatus === 'due') {
        const tenant_id = await getTenantId();
        const label = finalStatus === 'due' ? '⚠️ OVERDUE' : '⚡ Approaching Due';
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        // Verificar si ya existe notificacion de este mantenimiento hoy
        const { data: existing } = await supabase
          .from('notifications' as any)
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('type', 'maintenance')
          .ilike('message', `${item.maintenance_type}%`)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .limit(1);

        if (existing && (existing as any[]).length > 0) {
          console.log(`[MaintenanceAutoCheck] Notificacion ya enviada hoy para ${item.maintenance_type}, skipping.`);
          continue;
        }

        // Notificacion en app
        await supabase.from('notifications' as any).insert({
          tenant_id,
          title: `Maintenance ${label}`,
          message: `${item.maintenance_type} is ${
            finalStatus === 'due' ? 'overdue' : 'approaching due date'
          }. ${miles_accumulated.toLocaleString()} mi accumulated.`,
          type: 'maintenance',
        } as any);

        // WhatsApp al driver asignado al camion
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke('send-maintenance-whatsapp', {
              body: {
                maintenanceId: item.id,
                maintenanceType: item.maintenance_type,
                status: finalStatus,
                milesAccumulated: miles_accumulated,
                truckId: item.truck_id,
              },
            });
          }
        } catch (e) {
          console.warn('[MaintenanceAutoCheck] WhatsApp send failed:', e);
        }
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

const STORAGE_KEY = 'maintenance_last_check_date';

function getLastCheckDate(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function setLastCheckDate(): void {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10)); } catch {}
}

function shouldRunCheck(): boolean {
  const last = getLastCheckDate();
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

export function useMaintenanceAutoCheck() {
  const qc = useQueryClient();
  const ranOnce = useRef(false);
  const dailyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = async () => {
    if (!shouldRunCheck()) {
      console.log('[MaintenanceAutoCheck] Already ran today, skipping.');
      return;
    }
    console.log('[MaintenanceAutoCheck] Running check...');
    await runMaintenanceCheck();
    setLastCheckDate();
    console.log('[MaintenanceAutoCheck] Done.');
    qc.invalidateQueries({ queryKey: ['truck_maintenance'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const scheduleDailyCheck = () => {
    const ms = msUntilNext8am();
    dailyTimer.current = setTimeout(() => {
      // Forzar el check aunque ya haya corrido hoy (es el disparo de las 8am)
      localStorage.removeItem(STORAGE_KEY);
      check();
      dailyTimer.current = setInterval(() => {
        localStorage.removeItem(STORAGE_KEY);
        check();
      }, 24 * 60 * 60 * 1000);
    }, ms);
  };

  useEffect(() => {
    if (!ranOnce.current) {
      ranOnce.current = true;
      check();
    }
    scheduleDailyCheck();
    return () => {
      if (dailyTimer.current) clearTimeout(dailyTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

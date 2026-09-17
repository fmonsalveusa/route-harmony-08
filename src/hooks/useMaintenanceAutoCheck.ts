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

  // Odómetro actual de cada camión (ingresado manualmente)
  const { data: trucks } = await supabase
    .from('trucks' as any)
    .select('id, current_odometer')
    .in('id', truckIds);
  const odometerByTruck = new Map(
    ((trucks as any[]) || []).map((t: any) => [String(t.id), Number(t.current_odometer) || 0])
  );

  for (const truckId of truckIds) {
    const truckItems = (items as any[]).filter((m: any) => m.truck_id === truckId);
    const currentOdometer = odometerByTruck.get(String(truckId)) || 0;

    for (const item of truckItems) {
      // Misma fórmula que la página Maintenance: odómetro actual − odómetro del último servicio.
      // Antes se sumaban millas de cargas por fecha de modificación, lo que inflaba el acumulado
      // cada vez que se editaba una carga vieja y marcaba camiones como vencidos sin estarlo.
      const miles_accumulated = currentOdometer > 0 && item.last_miles > 0
        ? Math.max(0, currentOdometer - item.last_miles)
        : 0;

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
        const today = new Date().toISOString().slice(0, 10);

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

        // Obtener unit number del camion y nombre del driver
        const { data: truck } = await supabase
          .from('trucks' as any)
          .select('unit_number')
          .eq('id', item.truck_id)
          .maybeSingle();

        const { data: driver } = await supabase
          .from('drivers' as any)
          .select('name')
          .eq('truck_id', item.truck_id)
          .maybeSingle();

        const unitLabel = (truck as any)?.unit_number ? `Unit #${(truck as any).unit_number}` : '';
        const driverLabel = (driver as any)?.name ? (driver as any).name : '';
        const contextLabel = [unitLabel, driverLabel].filter(Boolean).join(' - ');

        // Notificacion en app
        await supabase.from('notifications' as any).insert({
          tenant_id,
          title: `Maintenance ${label}${unitLabel ? ` | ${unitLabel}` : ''}`,
          message: `${item.maintenance_type} is ${
            finalStatus === 'due' ? 'overdue' : 'approaching due date'
          }.${contextLabel ? ` ${contextLabel}.` : ''} ${miles_accumulated.toLocaleString()} mi accumulated.`,
          type: 'maintenance',
        } as any);
      }
    }
  }
}

function msUntilNext8am(): number {
  const now = new Date();
  const next8am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
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

// Flag global para evitar que multiples instancias del hook programen timers
let globalTimerScheduled = false;

export function useMaintenanceAutoCheck() {
  const qc = useQueryClient();
  const ranOnce = useRef(false);

  const check = async (force = false) => {
    if (!force && !shouldRunCheck()) {
      console.log('[MaintenanceAutoCheck] Already ran today, skipping.');
      return;
    }
    console.log('[MaintenanceAutoCheck] Running check...');
    setLastCheckDate(); // Marcar ANTES de correr para evitar runs concurrentes
    await runMaintenanceCheck();
    console.log('[MaintenanceAutoCheck] Done.');
    qc.invalidateQueries({ queryKey: ['truck_maintenance'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  useEffect(() => {
    // Correr una vez al montar si no ha corrido hoy
    if (!ranOnce.current) {
      ranOnce.current = true;
      void check();
    }

    // Programar el check diario a las 8am — solo una vez globalmente
    if (!globalTimerScheduled) {
      globalTimerScheduled = true;
      const scheduleNext = () => {
        const ms = msUntilNext8am();
        console.log(`[MaintenanceAutoCheck] Proximo check en ${Math.round(ms / 3600000)}h`);
        setTimeout(() => {
          void check(true); // forzar aunque ya haya corrido hoy
          scheduleNext();   // programar el siguiente dia
        }, ms);
      };
      scheduleNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

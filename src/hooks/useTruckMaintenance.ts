import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface DbTruckMaintenance {
  id: string;
  truck_id: string;
  tenant_id: string | null;
  maintenance_type: string;
  description: string | null;
  interval_miles: number | null;
  interval_days: number | null;
  last_performed_at: string;
  last_miles: number;
  next_due_miles: number | null;
  next_due_date: string | null;
  miles_accumulated: number;
  status: string;
  cost: number | null;
  vendor: string | null;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceInput {
  truck_id: string;
  maintenance_type: string;
  description?: string | null;
  interval_miles?: number | null;
  interval_days?: number | null;
  last_performed_at: string;
  last_miles: number;
  cost?: number | null;
  tax_amount?: number | null;
  vendor?: string | null;
  payment_method?: string;
  location?: string | null;
  invoice_number?: string | null;
  create_expense?: boolean;
}

const QUERY_KEY = ['truck_maintenance'];

async function fetchMaintenance(): Promise<DbTruckMaintenance[]> {
  const { data, error } = await supabase
    .from('truck_maintenance' as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

async function getDriverMetaForTruck(truckId: string) {
  const { data } = await supabase
    .from('drivers' as any)
    .select('name, service_type')
    .eq('truck_id', truckId)
    .limit(1)
    .maybeSingle();

  return {
    driverName: (data as any)?.name || null,
    driverServiceType: (data as any)?.service_type || null,
  };
}

async function buildMaintenanceExpensePayload(params: {
  tenant_id: string | null;
  truck_id: string;
  expense_date: string;
  maintenance_type: string;
  cost: number;
  tax_amount?: number | null;
  vendor?: string | null;
  payment_method?: string;
  location?: string | null;
  invoice_number?: string | null;
}) {
  const { driverName, driverServiceType } = await getDriverMetaForTruck(params.truck_id);

  return {
    tenant_id: params.tenant_id,
    expense_date: params.expense_date,
    truck_id: params.truck_id,
    expense_type: 'maintenance',
    description: params.maintenance_type,
    category: params.maintenance_type,
    amount: params.cost,
    tax_amount: params.tax_amount || null,
    vendor: params.vendor || null,
    payment_method: params.payment_method || 'other',
    location: params.location || null,
    invoice_number: params.invoice_number || null,
    source: 'maintenance',
    driver_name: driverName,
    driver_service_type: driverServiceType,
  };
}

export function useTruckMaintenance() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const qc = useQueryClient();

  const { data: maintenanceItems = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMaintenance,
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: QUERY_KEY }), [qc]);

  const createMaintenance = useCallback(async (input: MaintenanceInput) => {
    const tenant_id = await getTenantId();
    const next_due_miles = input.interval_miles ? input.last_miles + input.interval_miles : null;
    const next_due_date = input.interval_days
      ? new Date(new Date(input.last_performed_at).getTime() + input.interval_days * 86400000).toISOString().split('T')[0]
      : null;

    let expense_id: string | null = null;

    // Auto-create expense if cost > 0
    if (input.create_expense !== false && input.cost && input.cost > 0) {
      const expensePayload = await buildMaintenanceExpensePayload({
        tenant_id,
        truck_id: input.truck_id,
        expense_date: input.last_performed_at,
        maintenance_type: input.maintenance_type,
        cost: input.cost,
        tax_amount: input.tax_amount,
        vendor: input.vendor,
        payment_method: input.payment_method,
        location: input.location,
        invoice_number: input.invoice_number,
      });
      console.log('[createMaintenance] expensePayload:', expensePayload);

      const { data: expData, error: expErr } = await supabase
        .from('expenses' as any)
        .insert(expensePayload as any)
        .select('id');

      if (expErr) {
        console.error('Expense creation error:', expErr);
        toastRef.current({ title: 'Error creating expense', description: expErr.message, variant: 'destructive' });
      } else if (expData && (expData as any[]).length > 0) {
        expense_id = (expData as any[])[0]?.id || null;
      } else {
        console.warn('[createMaintenance] Expense insert returned no data but no error');
      }
    }

    const { error } = await supabase.from('truck_maintenance' as any).insert({
      truck_id: input.truck_id,
      tenant_id,
      maintenance_type: input.maintenance_type,
      description: input.description || null,
      interval_miles: input.interval_miles || null,
      interval_days: input.interval_days || null,
      last_performed_at: input.last_performed_at,
      last_miles: input.last_miles,
      next_due_miles,
      next_due_date,
      miles_accumulated: 0,
      status: 'ok',
      cost: input.cost || null,
      vendor: input.vendor || null,
      expense_id,
    } as any);

    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Maintenance schedule created' });
    invalidate();
    qc.invalidateQueries({ queryKey: ['expenses'] });
    return true;
  }, [invalidate, qc]);

  const updateMaintenance = useCallback(async (id: string, input: Partial<MaintenanceInput>) => {
    const updates: Record<string, any> = {};
    const allowedKeys = ['truck_id', 'maintenance_type', 'description', 'interval_miles', 'interval_days', 'last_performed_at', 'last_miles', 'cost', 'vendor'];
    for (const key of allowedKeys) {
      if (key in input) updates[key] = (input as any)[key];
    }
    if (input.interval_miles !== undefined && input.last_miles !== undefined) {
      updates.next_due_miles = input.interval_miles ? input.last_miles + input.interval_miles : null;
    }
    if (input.interval_days !== undefined && input.last_performed_at) {
      updates.next_due_date = input.interval_days
        ? new Date(new Date(input.last_performed_at).getTime() + input.interval_days * 86400000).toISOString().split('T')[0]
        : null;
    }

    const { error } = await supabase.from('truck_maintenance' as any).update(updates as any).eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Maintenance updated' });
    invalidate();
    return true;
  }, [invalidate]);

  const deleteMaintenance = useCallback(async (id: string) => {
    const { error } = await supabase.from('truck_maintenance' as any).delete().eq('id', id);
    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Maintenance deleted' });
    invalidate();
    return true;
  }, [invalidate]);

  const recalculateMiles = useCallback(async (truckId: string) => {
    // Get all maintenance items for this truck
    const items = maintenanceItems.filter(m => m.truck_id === truckId);
    if (!items.length) return;

    for (const item of items) {
      // Sum loaded + empty miles from loads since last service
      const { data, error } = await supabase
        .from('loads' as any)
        .select('miles, empty_miles')
        .eq('truck_id', truckId)
        .gte('pickup_date', item.last_performed_at)
        .in('status', ['in_transit', 'delivered', 'paid']);

      if (error) { console.error(error); continue; }

      const miles_accumulated = ((data as any[]) || []).reduce((sum, l) => {
        return sum + (Number(l.miles) || 0) + (Number(l.empty_miles) || 0);
      }, 0);

      // Compute status
      let milesStatus = 'ok';
      if (item.interval_miles && item.interval_miles > 0) {
        const pct = miles_accumulated / item.interval_miles;
        if (pct >= 1) milesStatus = 'due';
        else if (pct >= 0.8) milesStatus = 'warning';
      }

      let dateStatus = 'ok';
      if (item.next_due_date) {
        const dueDate = new Date(item.next_due_date);
        const now = new Date();
        const daysUntil = (dueDate.getTime() - now.getTime()) / 86400000;
        if (daysUntil <= 0) dateStatus = 'due';
        else if (daysUntil <= 30) dateStatus = 'warning';
      }

      const statusOrder = { ok: 0, warning: 1, due: 2 };
      const finalStatus = (statusOrder[dateStatus as keyof typeof statusOrder] || 0) >=
        (statusOrder[milesStatus as keyof typeof statusOrder] || 0)
        ? dateStatus : milesStatus;

      const oldStatus = item.status;

      await supabase.from('truck_maintenance' as any)
        .update({ miles_accumulated, status: finalStatus } as any)
        .eq('id', item.id);

      // Create notification if status worsened
      if (finalStatus !== oldStatus && (finalStatus === 'warning' || finalStatus === 'due')) {
        const tenant_id = await getTenantId();
        const label = finalStatus === 'due' ? '⚠️ OVERDUE' : '⚡ Approaching';
        await supabase.from('notifications' as any).insert({
          tenant_id,
          title: `Maintenance ${label}`,
          message: `${item.maintenance_type} for truck is ${finalStatus === 'due' ? 'overdue' : 'approaching due'}. ${miles_accumulated.toLocaleString()} mi accumulated.`,
          type: 'maintenance',
        } as any);
      }
    }
    invalidate();
  }, [maintenanceItems, invalidate]);

  const logNewService = useCallback(async (id: string, input: {
    last_performed_at: string;
    last_miles: number;
    cost?: number | null;
    tax_amount?: number | null;
    vendor?: string | null;
    payment_method?: string;
    location?: string | null;
    invoice_number?: string | null;
    create_expense?: boolean;
  }) => {
    const item = maintenanceItems.find(m => m.id === id);
    if (!item) return false;

    const next_due_miles = item.interval_miles ? input.last_miles + item.interval_miles : null;
    const next_due_date = item.interval_days
      ? new Date(new Date(input.last_performed_at).getTime() + item.interval_days * 86400000).toISOString().split('T')[0]
      : null;

    let expense_id: string | null = null;
    if (input.create_expense !== false && input.cost && input.cost > 0) {
      const tenant_id = await getTenantId();
      const expensePayload = await buildMaintenanceExpensePayload({
        tenant_id,
        truck_id: item.truck_id,
        expense_date: input.last_performed_at,
        maintenance_type: item.maintenance_type,
        cost: input.cost,
        tax_amount: input.tax_amount,
        vendor: input.vendor,
        payment_method: input.payment_method,
        location: input.location,
        invoice_number: input.invoice_number,
      });
      console.log('Creating expense from maintenance log:', expensePayload);
      const { data: expData, error: expError } = await supabase
        .from('expenses' as any)
        .insert(expensePayload as any)
        .select('id');
      if (expError) {
        console.error('Expense creation error:', expError);
        toastRef.current({ title: 'Error creating expense', description: expError.message, variant: 'destructive' });
      } else if (expData && (expData as any[]).length > 0) {
        expense_id = (expData as any[])[0]?.id || null;
      } else {
        console.warn('Expense insert returned no data but no error. expense_id will be null.');
      }
    }

    // Insert into service log history
    const tenant_id2 = await getTenantId();
    await supabase.from('maintenance_service_log' as any).insert({
      maintenance_id: id,
      tenant_id: tenant_id2,
      performed_at: input.last_performed_at,
      odometer_miles: input.last_miles,
      cost: input.cost || null,
      vendor: input.vendor || null,
      expense_id,
    } as any);

    const { error } = await supabase.from('truck_maintenance' as any)
      .update({
        last_performed_at: input.last_performed_at,
        last_miles: input.last_miles,
        next_due_miles,
        next_due_date,
        miles_accumulated: 0,
        status: 'ok',
        cost: input.cost || null,
        vendor: input.vendor || null,
        expense_id,
      } as any)
      .eq('id', id);

    if (error) {
      toastRef.current({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: 'Service logged successfully' });
    invalidate();
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['service_log', id] });
    return true;
  }, [maintenanceItems, invalidate, qc]);

  return {
    maintenanceItems,
    loading,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
    recalculateMiles,
    logNewService,
    refetch: invalidate,
  };
}

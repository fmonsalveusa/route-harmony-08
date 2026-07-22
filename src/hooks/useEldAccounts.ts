import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

// Proveedores ELD soportados. Se amplía aquí cuando se agregue uno nuevo.
export type EldProvider = 'hos247' | 'routeone';

export interface DbEldAccount {
  id: string;
  provider: EldProvider;
  api_user: string | null;
  company_id: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  tenant_id: string | null;
  vault_secret_id: string | null; // referencia al password encriptado en Vault
  created_at: string;
  updated_at: string;
}

// El password NUNCA sale de la BD hacia el frontend. Solo se envía al crear/editar.
export interface EldAccountInput {
  provider: EldProvider;
  api_user: string;
  password?: string;      // opcional al editar: si viene vacío, no se cambia
  company_id?: string | null;
  is_active?: boolean;
}

const QUERY_KEY = ['eld_accounts'];

async function fetchEldAccounts(): Promise<DbEldAccount[]> {
  // Seleccionamos columnas explícitas: jamás traemos api_password_encrypted ni el secret.
  const { data, error } = await supabase
    .from('eld_accounts' as any)
    .select('id, provider, api_user, company_id, is_active, last_synced_at, tenant_id, vault_secret_id, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

export function useEldAccounts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: accounts = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchEldAccounts,
  });

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    [qc]
  );

  const createAccount = useCallback(async (input: EldAccountInput) => {
    const tenant_id = await getTenantId();

    // 1. Insertamos la cuenta sin el password (ese va a Vault aparte)
    const { data, error } = await supabase
      .from('eld_accounts' as any)
      .insert({
        provider: input.provider,
        api_user: input.api_user,
        company_id: input.company_id || null,
        is_active: input.is_active ?? true,
        tenant_id,
      } as any)
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Error creando cuenta ELD', description: error.message, variant: 'destructive' });
      return false;
    }

    const accountId = (data as any).id;

    // 2. Guardamos el password en Vault vía la función RPC (encripta y guarda solo la referencia)
    if (input.password) {
      const { error: pwErr } = await supabase.rpc('set_eld_password' as any, {
        account_id: accountId,
        new_password: input.password,
      });
      if (pwErr) {
        toast({ title: 'Cuenta creada, pero falló guardar el password', description: pwErr.message, variant: 'destructive' });
        invalidate();
        return false;
      }
    }

    toast({ title: 'Cuenta ELD creada' });
    invalidate();
    return true;
  }, [toast, invalidate]);

  const updateAccount = useCallback(async (id: string, input: Partial<EldAccountInput>) => {
    // Actualizamos solo los campos no sensibles
    const updates: Record<string, any> = {};
    if (input.provider !== undefined) updates.provider = input.provider;
    if (input.api_user !== undefined) updates.api_user = input.api_user;
    if (input.company_id !== undefined) updates.company_id = input.company_id || null;
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('eld_accounts' as any).update(updates as any).eq('id', id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return false;
      }
    }

    // El password solo se toca si el usuario escribió uno nuevo (campo vacío = no cambiar)
    if (input.password) {
      const { error: pwErr } = await supabase.rpc('set_eld_password' as any, {
        account_id: id,
        new_password: input.password,
      });
      if (pwErr) {
        toast({ title: 'Error actualizando password', description: pwErr.message, variant: 'destructive' });
        return false;
      }
    }

    toast({ title: 'Cuenta ELD actualizada' });
    invalidate();
    return true;
  }, [toast, invalidate]);

  const toggleActive = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('eld_accounts' as any).update({ is_active } as any).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    invalidate();
    return true;
  }, [toast, invalidate]);

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase.from('eld_accounts' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cuenta ELD eliminada' });
    invalidate();
    return true;
  }, [toast, invalidate]);

  return {
    accounts,
    loading,
    createAccount,
    updateAccount,
    toggleActive,
    deleteAccount,
    refetch: invalidate,
  };
}

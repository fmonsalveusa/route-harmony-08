import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedTenantId: string | null = null;
let cacheUserId: string | null = null;

export function useTenantId() {
  const [tenantId, setTenantId] = useState<string | null>(cachedTenantId);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (cacheUserId === user.id && cachedTenantId) {
        setTenantId(cachedTenantId);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (data?.tenant_id) {
        cachedTenantId = data.tenant_id;
        cacheUserId = user.id;
        setTenantId(data.tenant_id);
      }
    })();
  }, []);

  return tenantId;
}

/** Get tenant_id for the current user (one-shot, for use outside hooks) */
export async function getTenantId(): Promise<string | null> {
  if (cachedTenantId) return cachedTenantId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (data?.tenant_id) {
    cachedTenantId = data.tenant_id;
    cacheUserId = user.id;
  }
  return data?.tenant_id || null;
}

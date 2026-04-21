import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DispatcherScope {
  loading: boolean;
  dispatcherId: string | null;
  driverIds: Set<string> | null;
}

/**
 * Resolves the dispatcher scope for the currently logged-in user.
 *
 * Finds the dispatcher record by matching the user's profile email against
 * the dispatchers table, then fetches all driver IDs assigned to them.
 *
 * Returns null driverIds for non-dispatcher roles (no restriction applied).
 */
export function useDispatcherDriverIds(): DispatcherScope {
  const { role, profile } = useAuth();
  const isDispatcher = role === 'dispatcher';

  const [loading, setLoading] = useState(isDispatcher);
  const [dispatcherId, setDispatcherId] = useState<string | null>(null);
  const [driverIds, setDriverIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isDispatcher || !profile?.email) {
      setLoading(false);
      setDispatcherId(null);
      setDriverIds(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchScope = async () => {
      // Step 1: find this user's dispatcher record by email
      const { data: dispRows, error: dispErr } = await supabase
        .from('dispatchers' as any)
        .select('id')
        .ilike('email', profile.email) // case-insensitive match
        .limit(1);

      if (cancelled) return;

      const dispRecord = (dispRows as { id: string }[] | null)?.[0];

      if (dispErr || !dispRecord) {
        console.warn('[useDispatcherDriverIds] No dispatcher record for:', profile.email, dispErr);
        setDispatcherId(null);
        setDriverIds(new Set()); // empty = show nothing (safe default)
        setLoading(false);
        return;
      }

      const resolvedId = dispRecord.id;
      setDispatcherId(resolvedId);

      // Step 2: get all driver IDs assigned to this dispatcher
      const { data: driverRows, error: drErr } = await supabase
        .from('drivers' as any)
        .select('id')
        .eq('dispatcher_id', resolvedId);

      if (cancelled) return;

      if (drErr) {
        console.warn('[useDispatcherDriverIds] Could not fetch driver IDs:', drErr);
        setDriverIds(new Set());
      } else {
        setDriverIds(new Set((driverRows as { id: string }[]).map(r => r.id)));
      }

      setLoading(false);
    };

    void fetchScope();
    return () => { cancelled = true; };
  }, [isDispatcher, profile?.email]);

  return { loading, dispatcherId, driverIds };
}

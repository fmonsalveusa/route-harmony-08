import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useDrivers } from '@/hooks/useDrivers';

/**
 * Returns the dispatcher's own ID and the set of driver IDs assigned to them.
 * When the current user is NOT a dispatcher, dispatcherId and driverIds are null
 * (meaning no scope restriction should be applied).
 */
export function useDispatcherScope() {
  const { role, profile } = useAuth();
  const { dispatchers } = useDispatchers();
  const { drivers } = useDrivers();

  const isDispatcher = role === 'dispatcher';

  const dispatcherId = useMemo(() => {
    if (!isDispatcher || !profile?.email) return null;
    return (
      dispatchers.find(
        (d) => d.email.toLowerCase() === profile.email.toLowerCase()
      )?.id ?? null
    );
  }, [isDispatcher, profile?.email, dispatchers]);

  const driverIds = useMemo<Set<string> | null>(() => {
    if (!dispatcherId) return null;
    return new Set(
      drivers.filter((d) => d.dispatcher_id === dispatcherId).map((d) => d.id)
    );
  }, [dispatcherId, drivers]);

  return { isDispatcher, dispatcherId, driverIds };
}

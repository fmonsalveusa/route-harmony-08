-- Add index on pickup_date to speed up the ORDER BY query
CREATE INDEX IF NOT EXISTS idx_loads_pickup_date ON public.loads (pickup_date DESC NULLS LAST);

-- Add index on loads.dispatcher_id used by RLS policy
CREATE INDEX IF NOT EXISTS idx_loads_dispatcher_id ON public.loads (dispatcher_id);

-- Add index on loads.driver_id 
CREATE INDEX IF NOT EXISTS idx_loads_driver_id ON public.loads (driver_id);

-- Add index on user_roles for faster RLS lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles (user_id, role);
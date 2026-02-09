
-- Update trucks SELECT policy: dispatchers only see trucks with their assigned drivers
DROP POLICY IF EXISTS "Tenant users can read trucks" ON public.trucks;

CREATE POLICY "Tenant users can read trucks"
ON public.trucks
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      NOT has_role(auth.uid(), 'dispatcher')
      OR id::text IN (
        SELECT truck_id FROM public.drivers
        WHERE dispatcher_id = get_user_dispatcher_id(auth.uid())
        AND truck_id IS NOT NULL
      )
    )
  )
);

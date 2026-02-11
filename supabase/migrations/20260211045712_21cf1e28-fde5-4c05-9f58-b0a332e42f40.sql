
-- Update drivers SELECT policy to also allow dispatchers to see drivers
-- that appear on loads assigned to them (even if the driver's default dispatcher is different)
DROP POLICY "Authorized roles can read drivers" ON public.drivers;

CREATE POLICY "Authorized roles can read drivers"
ON public.drivers
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'accounting'::app_role)
      OR (
        has_role(auth.uid(), 'dispatcher'::app_role)
        AND (
          dispatcher_id = get_user_dispatcher_id(auth.uid())
          OR id::text IN (
            SELECT driver_id FROM public.loads
            WHERE dispatcher_id = get_user_dispatcher_id(auth.uid())
            AND driver_id IS NOT NULL
          )
        )
      )
    )
  )
);

-- Update trucks SELECT policy similarly so dispatcher can see trucks
-- used on their assigned loads
DROP POLICY "Tenant users can read trucks" ON public.trucks;

CREATE POLICY "Tenant users can read trucks"
ON public.trucks
FOR SELECT
USING (
  is_master_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      NOT has_role(auth.uid(), 'dispatcher'::app_role)
      OR id::text IN (
        SELECT drivers.truck_id FROM public.drivers
        WHERE drivers.dispatcher_id = get_user_dispatcher_id(auth.uid())
        AND drivers.truck_id IS NOT NULL
      )
      OR id::text IN (
        SELECT truck_id FROM public.loads
        WHERE dispatcher_id = get_user_dispatcher_id(auth.uid())
        AND truck_id IS NOT NULL
      )
    )
  )
);

-- Allow drivers to read their own driver record (matched by email)
DROP POLICY "Authorized roles can read drivers" ON public.drivers;

CREATE POLICY "Authorized roles can read drivers"
ON public.drivers
FOR SELECT
USING (
  is_master_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (
      has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'accounting') 
      OR (
        has_role(auth.uid(), 'dispatcher') 
        AND (
          dispatcher_id = get_user_dispatcher_id(auth.uid()) 
          OR (id)::text IN (
            SELECT loads.driver_id FROM loads 
            WHERE loads.dispatcher_id = get_user_dispatcher_id(auth.uid()) AND loads.driver_id IS NOT NULL
          )
        )
      )
      OR (
        has_role(auth.uid(), 'driver') 
        AND LOWER(email) = LOWER((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
      )
    )
  )
);
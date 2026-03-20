
-- Drop and recreate the SELECT policy on drivers to add investor_email matching
DROP POLICY IF EXISTS "Authorized roles can read drivers" ON public.drivers;

CREATE POLICY "Authorized roles can read drivers"
ON public.drivers
FOR SELECT
TO public
USING (
  -- Master admin
  (auth.uid() IN (SELECT p.id FROM profiles p WHERE p.is_master_admin = true))
  OR
  (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (
      -- Admin/accounting roles
      (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::app_role, 'accounting'::app_role])))
      OR
      -- Dispatcher role
      (
        (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher'::app_role))
        AND (
          dispatcher_id = (
            SELECT (d.id)::text FROM dispatchers d JOIN profiles p2 ON p2.email = d.email
            WHERE p2.id = auth.uid() AND d.tenant_id = (SELECT p3.tenant_id FROM profiles p3 WHERE p3.id = auth.uid())
            LIMIT 1
          )
          OR (id)::text IN (
            SELECT l.driver_id FROM loads l
            WHERE l.dispatcher_id = (
              SELECT (d2.id)::text FROM dispatchers d2 JOIN profiles p4 ON p4.email = d2.email
              WHERE p4.id = auth.uid() AND d2.tenant_id = (SELECT p5.tenant_id FROM profiles p5 WHERE p5.id = auth.uid())
              LIMIT 1
            ) AND l.driver_id IS NOT NULL
          )
        )
      )
      OR
      -- Driver role: own record by email
      (
        (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'driver'::app_role))
        AND lower(email) = lower((SELECT p6.email FROM profiles p6 WHERE p6.id = auth.uid()))
      )
      OR
      -- Investor role OR driver+investor: can see drivers where they are investor
      (
        lower(investor_email) = lower((SELECT p7.email FROM profiles p7 WHERE p7.id = auth.uid()))
      )
    )
  )
);

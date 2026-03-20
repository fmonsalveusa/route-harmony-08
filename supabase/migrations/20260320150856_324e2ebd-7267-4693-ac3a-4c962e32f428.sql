
-- Fix payments RLS: allow drivers and investors to read their own payments
DROP POLICY IF EXISTS "Tenant users can read payments" ON public.payments;

CREATE POLICY "Tenant users can read payments"
ON public.payments
FOR SELECT
TO public
USING (
  -- Master admin
  (auth.uid() IN (SELECT p.id FROM profiles p WHERE p.is_master_admin = true))
  OR
  (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (
      -- Non-dispatcher, non-driver, non-investor roles (admin, accounting) see all tenant payments
      (NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('dispatcher'::app_role, 'driver'::app_role, 'investor'::app_role)
      ))
      OR
      -- Dispatcher: only their loads
      (
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher'::app_role)
        AND load_id IN (
          SELECT l.id FROM loads l
          WHERE l.dispatcher_id = get_user_dispatcher_id(auth.uid())
        )
      )
      OR
      -- Driver: own payments (by driver record email match)
      (
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'driver'::app_role)
        AND recipient_type = 'driver'
        AND recipient_id IN (
          SELECT d.id::text FROM drivers d
          WHERE lower(d.email) = lower((SELECT p2.email FROM profiles p2 WHERE p2.id = auth.uid()))
        )
      )
      OR
      -- Investor payments: user's email matches investor_email on the driver record
      (
        recipient_type = 'investor'
        AND recipient_id IN (
          SELECT d.id::text FROM drivers d
          WHERE lower(d.investor_email) = lower((SELECT p3.email FROM profiles p3 WHERE p3.id = auth.uid()))
        )
      )
    )
  )
);


-- Optimize DRIVERS SELECT policy
DROP POLICY IF EXISTS "Authorized roles can read drivers" ON public.drivers;
CREATE POLICY "Authorized roles can read drivers" ON public.drivers
FOR SELECT USING (
  (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
  OR (
    tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'accounting'))
      OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher')
        AND (
          dispatcher_id = (
            SELECT d.id::text FROM public.dispatchers d
            INNER JOIN public.profiles p2 ON p2.email = d.email
            WHERE p2.id = auth.uid()
            AND d.tenant_id = (SELECT p3.tenant_id FROM public.profiles p3 WHERE p3.id = auth.uid())
            LIMIT 1
          )
          OR id::text IN (
            SELECT l.driver_id FROM public.loads l
            WHERE l.dispatcher_id = (
              SELECT d2.id::text FROM public.dispatchers d2
              INNER JOIN public.profiles p4 ON p4.email = d2.email
              WHERE p4.id = auth.uid()
              AND d2.tenant_id = (SELECT p5.tenant_id FROM public.profiles p5 WHERE p5.id = auth.uid())
              LIMIT 1
            )
            AND l.driver_id IS NOT NULL
          )
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'driver')
        AND lower(email) = lower((SELECT p6.email FROM public.profiles p6 WHERE p6.id = auth.uid()))
      )
    )
  )
);

-- DRIVERS: simple policies
DROP POLICY IF EXISTS "Tenant users can update drivers" ON public.drivers;
CREATE POLICY "Tenant users can update drivers" ON public.drivers
FOR UPDATE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can insert drivers" ON public.drivers;
CREATE POLICY "Tenant users can insert drivers" ON public.drivers
FOR INSERT WITH CHECK (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can delete drivers" ON public.drivers;
CREATE POLICY "Tenant users can delete drivers" ON public.drivers
FOR DELETE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

-- TRUCKS: Optimize SELECT
DROP POLICY IF EXISTS "Tenant users can read trucks" ON public.trucks;
CREATE POLICY "Tenant users can read trucks" ON public.trucks
FOR SELECT USING (
  (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
  OR (
    tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher')
      OR id::text IN (
        SELECT dr.truck_id FROM public.drivers dr
        WHERE dr.dispatcher_id = (
          SELECT d.id::text FROM public.dispatchers d
          INNER JOIN public.profiles p2 ON p2.email = d.email
          WHERE p2.id = auth.uid()
          AND d.tenant_id = (SELECT p3.tenant_id FROM public.profiles p3 WHERE p3.id = auth.uid())
          LIMIT 1
        )
        AND dr.truck_id IS NOT NULL
      )
      OR id::text IN (
        SELECT l.truck_id FROM public.loads l
        WHERE l.dispatcher_id = (
          SELECT d2.id::text FROM public.dispatchers d2
          INNER JOIN public.profiles p4 ON p4.email = d2.email
          WHERE p4.id = auth.uid()
          AND d2.tenant_id = (SELECT p5.tenant_id FROM public.profiles p5 WHERE p5.id = auth.uid())
          LIMIT 1
        )
        AND l.truck_id IS NOT NULL
      )
    )
  )
);

-- TRUCKS: simple policies
DROP POLICY IF EXISTS "Tenant users can update trucks" ON public.trucks;
CREATE POLICY "Tenant users can update trucks" ON public.trucks
FOR UPDATE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can insert trucks" ON public.trucks;
CREATE POLICY "Tenant users can insert trucks" ON public.trucks
FOR INSERT WITH CHECK (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can delete trucks" ON public.trucks;
CREATE POLICY "Tenant users can delete trucks" ON public.trucks
FOR DELETE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

-- PAYMENTS: Optimize SELECT
DROP POLICY IF EXISTS "Tenant users can read payments" ON public.payments;
CREATE POLICY "Tenant users can read payments" ON public.payments
FOR SELECT USING (
  (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
  OR (
    tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher')
      OR load_id IN (
        SELECT l.id FROM public.loads l
        WHERE l.dispatcher_id = (
          SELECT d.id::text FROM public.dispatchers d
          INNER JOIN public.profiles p2 ON p2.email = d.email
          WHERE p2.id = auth.uid()
          AND d.tenant_id = (SELECT p3.tenant_id FROM public.profiles p3 WHERE p3.id = auth.uid())
          LIMIT 1
        )
      )
    )
  )
);

-- PAYMENTS: simple policies
DROP POLICY IF EXISTS "Tenant users can update payments" ON public.payments;
CREATE POLICY "Tenant users can update payments" ON public.payments
FOR UPDATE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can insert payments" ON public.payments;
CREATE POLICY "Tenant users can insert payments" ON public.payments
FOR INSERT WITH CHECK (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can delete payments" ON public.payments;
CREATE POLICY "Tenant users can delete payments" ON public.payments
FOR DELETE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);


-- Step 1: Add performance indices first (no locks on policies)
CREATE INDEX IF NOT EXISTS idx_profiles_id_tenant ON public.profiles (id) INCLUDE (tenant_id, is_master_admin, email);
CREATE INDEX IF NOT EXISTS idx_dispatchers_email_tenant ON public.dispatchers (email, tenant_id);

-- Step 2: Optimize LOADS SELECT policy (most queried table)
DROP POLICY IF EXISTS "Tenant users can read loads" ON public.loads;
CREATE POLICY "Tenant users can read loads" ON public.loads
FOR SELECT USING (
  (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
  OR (
    tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'dispatcher')
      OR dispatcher_id = (
        SELECT d.id::text FROM public.dispatchers d
        INNER JOIN public.profiles p2 ON p2.email = d.email
        WHERE p2.id = auth.uid()
        AND d.tenant_id = (SELECT p3.tenant_id FROM public.profiles p3 WHERE p3.id = auth.uid())
        LIMIT 1
      )
    )
  )
);

-- Step 3: Optimize simple tenant policies (loads INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Tenant users can update loads" ON public.loads;
CREATE POLICY "Tenant users can update loads" ON public.loads
FOR UPDATE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can insert loads" ON public.loads;
CREATE POLICY "Tenant users can insert loads" ON public.loads
FOR INSERT WITH CHECK (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can delete loads" ON public.loads;
CREATE POLICY "Tenant users can delete loads" ON public.loads
FOR DELETE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

-- Step 4: Notifications (queried frequently by realtime)
DROP POLICY IF EXISTS "Tenant users can read notifications" ON public.notifications;
CREATE POLICY "Tenant users can read notifications" ON public.notifications
FOR SELECT USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can insert notifications" ON public.notifications;
CREATE POLICY "Tenant users can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can update notifications" ON public.notifications;
CREATE POLICY "Tenant users can update notifications" ON public.notifications
FOR UPDATE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

DROP POLICY IF EXISTS "Tenant users can delete notifications" ON public.notifications;
CREATE POLICY "Tenant users can delete notifications" ON public.notifications
FOR DELETE USING (
  tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  OR (auth.uid() IN (SELECT p.id FROM public.profiles p WHERE p.is_master_admin = true))
);

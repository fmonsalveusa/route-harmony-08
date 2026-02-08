
-- The dispatchers policy already exists, just drop the duplicate and recreate if needed
DROP POLICY IF EXISTS "Tenant users can read dispatchers" ON public.dispatchers;

CREATE POLICY "Tenant users can read dispatchers"
ON public.dispatchers
FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR is_master_admin(auth.uid())
);

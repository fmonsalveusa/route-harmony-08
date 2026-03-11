-- Allow authenticated users to create a tenant (for registration)
CREATE POLICY "Authenticated users can create tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to insert their own role (for registration)
CREATE POLICY "Authenticated users can insert own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
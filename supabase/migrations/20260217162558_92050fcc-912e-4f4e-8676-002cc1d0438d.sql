
-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Tenant users can view driver documents" ON storage.objects;

-- Create a simpler tenant-based policy that doesn't depend on file path patterns
CREATE POLICY "Tenant users can view driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents'
  AND (
    is_master_admin(auth.uid())
    OR get_user_tenant_id(auth.uid()) IS NOT NULL
  )
);

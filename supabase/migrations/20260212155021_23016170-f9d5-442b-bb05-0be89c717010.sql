-- Fix storage SELECT policy to handle pods/ prefix
DROP POLICY IF EXISTS "Tenant users can view driver documents" ON storage.objects;

CREATE POLICY "Tenant users can view driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents'
  AND (
    is_master_admin(auth.uid())
    OR CASE
      WHEN name ~~ 'trucks/%' THEN EXISTS (
        SELECT 1 FROM trucks t
        WHERE objects.name ~~ ('trucks/' || t.id::text || '/%')
        AND t.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'pods/%' THEN EXISTS (
        SELECT 1 FROM loads l
        WHERE objects.name ~~ ('pods/' || l.id::text || '/%')
        AND l.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'loads/%' THEN EXISTS (
        SELECT 1 FROM loads
        WHERE loads.tenant_id = get_user_tenant_id(auth.uid())
      )
      ELSE EXISTS (
        SELECT 1 FROM drivers d
        WHERE objects.name ~~ (d.id::text || '/%')
        AND d.tenant_id = get_user_tenant_id(auth.uid())
      )
    END
  )
);

-- Fix storage DELETE policy to handle pods/ prefix
DROP POLICY IF EXISTS "Tenant users can delete driver documents" ON storage.objects;

CREATE POLICY "Tenant users can delete driver documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'driver-documents'
  AND (
    is_master_admin(auth.uid())
    OR CASE
      WHEN name ~~ 'trucks/%' THEN EXISTS (
        SELECT 1 FROM trucks t
        WHERE objects.name ~~ ('trucks/' || t.id::text || '/%')
        AND t.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'pods/%' THEN EXISTS (
        SELECT 1 FROM loads l
        WHERE objects.name ~~ ('pods/' || l.id::text || '/%')
        AND l.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'loads/%' THEN EXISTS (
        SELECT 1 FROM loads
        WHERE loads.tenant_id = get_user_tenant_id(auth.uid())
      )
      ELSE EXISTS (
        SELECT 1 FROM drivers d
        WHERE objects.name ~~ (d.id::text || '/%')
        AND d.tenant_id = get_user_tenant_id(auth.uid())
      )
    END
  )
);

-- Fix storage UPDATE policy to handle pods/ prefix
DROP POLICY IF EXISTS "Tenant users can update driver documents" ON storage.objects;

CREATE POLICY "Tenant users can update driver documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents'
  AND (
    is_master_admin(auth.uid())
    OR CASE
      WHEN name ~~ 'trucks/%' THEN EXISTS (
        SELECT 1 FROM trucks t
        WHERE objects.name ~~ ('trucks/' || t.id::text || '/%')
        AND t.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'pods/%' THEN EXISTS (
        SELECT 1 FROM loads l
        WHERE objects.name ~~ ('pods/' || l.id::text || '/%')
        AND l.tenant_id = get_user_tenant_id(auth.uid())
      )
      WHEN name ~~ 'loads/%' THEN EXISTS (
        SELECT 1 FROM loads
        WHERE loads.tenant_id = get_user_tenant_id(auth.uid())
      )
      ELSE EXISTS (
        SELECT 1 FROM drivers d
        WHERE objects.name ~~ (d.id::text || '/%')
        AND d.tenant_id = get_user_tenant_id(auth.uid())
      )
    END
  )
);
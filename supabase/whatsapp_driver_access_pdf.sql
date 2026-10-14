-- PDF opcional que se adjunta al mensaje de "Acceso a la app creado"
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_driver_access_pdf_path text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_driver_access_pdf_name text;

-- Los admins suben/borran archivos de WhatsApp en company-private/whatsapp/<tenant_id>/...
DROP POLICY IF EXISTS "admin_whatsapp_files" ON storage.objects;
CREATE POLICY "admin_whatsapp_files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'company-private' AND (storage.foldername(name))[1] = 'whatsapp'
    AND (storage.foldername(name))[2] = get_user_tenant_id(auth.uid())::text
    AND (has_role(auth.uid(), 'admin'::app_role) OR is_master_admin(auth.uid())))
  WITH CHECK (bucket_id = 'company-private' AND (storage.foldername(name))[1] = 'whatsapp'
    AND (storage.foldername(name))[2] = get_user_tenant_id(auth.uid())::text
    AND (has_role(auth.uid(), 'admin'::app_role) OR is_master_admin(auth.uid())));

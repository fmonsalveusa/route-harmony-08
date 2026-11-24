-- Dispatchers y accounting pueden LEER la clave de las extensiones (para pegarla en la extensión de DAT /
-- Asistente RTS). Crear, cambiar o borrar la clave sigue siendo solo de admin (política admin_manage).
DROP POLICY IF EXISTS staff_read ON public.integration_keys;
CREATE POLICY staff_read ON public.integration_keys
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT get_user_tenant_id(auth.uid()))
    AND (
      (SELECT has_role(auth.uid(), 'dispatcher'::app_role))
      OR (SELECT has_role(auth.uid(), 'accounting'::app_role))
    )
  );

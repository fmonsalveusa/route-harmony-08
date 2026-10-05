-- ═══ Seguridad: roles y pagos ═══
-- 1) Antes cualquier usuario del tenant (incluidos drivers) podía crear o cambiar roles,
--    o sea, hacerse admin. Ahora solo los admins del tenant (y el master admin).
DROP POLICY IF EXISTS "Tenant admins can manage roles" ON user_roles;
CREATE POLICY "Tenant admins can manage roles" ON user_roles FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2) Antes cualquier usuario del tenant veía todos los pagos. Ahora:
--    admin/accounting todo; dispatcher los de sus cargas y los suyos; driver los suyos;
--    investor los suyos (por su id o, en pagos viejos, por el id de sus drivers).
DROP POLICY IF EXISTS "Tenant users can read payments" ON payments;
CREATE POLICY "Tenant users can read payments" ON payments FOR SELECT
  USING (
    is_master_admin(auth.uid())
    OR (tenant_id = get_user_tenant_id(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'accounting'::app_role)
      OR (has_role(auth.uid(), 'dispatcher'::app_role) AND (
        (recipient_type = 'dispatcher' AND recipient_id = get_user_dispatcher_id(auth.uid()))
        OR load_id IN (SELECT l.id FROM loads l WHERE l.dispatcher_id = get_user_dispatcher_id(auth.uid()))
      ))
      OR (has_role(auth.uid(), 'driver'::app_role) AND recipient_id = get_user_driver_id(auth.uid()))
      OR (recipient_type = 'investor' AND recipient_id IN (
        SELECT i.id::text FROM investors i
        WHERE lower(i.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
        UNION
        SELECT di.driver_id::text FROM driver_investors di JOIN investors i ON i.id = di.investor_id
        WHERE di.is_active AND lower(i.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
      ))
    ))
  );

-- ═══ Conexión ELD propia de cada driver (HOS247 / RouteOne con su usuario) ═══
-- La contraseña vive cifrada en Supabase Vault; la tabla solo guarda el id del secreto.
-- Se escribe y se lee únicamente desde las Edge Functions (service role). Los admins ven
-- proveedor, usuario y estado, nunca la contraseña.

CREATE TABLE IF NOT EXISTS driver_eld_connections (
  driver_id uuid PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hos247', 'routeone')),
  username text NOT NULL,
  secret_id uuid,                 -- vault.secrets.id con la contraseña
  status text NOT NULL DEFAULT 'pending',   -- pending | ok | error
  last_error text,
  matched_unit text,              -- unidad que se encontró en esa cuenta
  last_ok_at timestamptz,
  last_tested_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_eld_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read" ON driver_eld_connections;
CREATE POLICY "admin_read" ON driver_eld_connections FOR SELECT
  USING (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
GRANT SELECT ON TABLE driver_eld_connections TO authenticated;
GRANT ALL ON TABLE driver_eld_connections TO service_role;

-- Guardar / reemplazar la contraseña en Vault (solo service role)
CREATE OR REPLACE FUNCTION eld_connection_set_password(p_driver_id uuid, p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_id uuid;
BEGIN
  SELECT secret_id INTO v_id FROM driver_eld_connections WHERE driver_id = p_driver_id;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_password, 'eld_driver_' || p_driver_id::text, 'Contraseña ELD del driver');
    UPDATE driver_eld_connections SET secret_id = v_id WHERE driver_id = p_driver_id;
  ELSE
    PERFORM vault.update_secret(v_id, p_password);
  END IF;
END $$;

-- Leer la contraseña (solo service role, desde las funciones de ELD)
CREATE OR REPLACE FUNCTION eld_connection_password(p_driver_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT ds.decrypted_secret FROM driver_eld_connections c
  JOIN vault.decrypted_secrets ds ON ds.id = c.secret_id
  WHERE c.driver_id = p_driver_id
$$;

-- Borrar la conexión y su secreto
CREATE OR REPLACE FUNCTION eld_connection_delete(p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_id uuid;
BEGIN
  SELECT secret_id INTO v_id FROM driver_eld_connections WHERE driver_id = p_driver_id;
  DELETE FROM driver_eld_connections WHERE driver_id = p_driver_id;
  IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
END $$;

REVOKE ALL ON FUNCTION eld_connection_set_password(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eld_connection_password(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eld_connection_delete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION eld_connection_set_password(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION eld_connection_password(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION eld_connection_delete(uuid) TO service_role;

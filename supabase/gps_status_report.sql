-- ═══ Reporte de GPS: además del permiso, la versión instalada de la app ═══
-- Varios drivers aparecían como "sin permiso" cuando en realidad tienen una app vieja
-- que no sabe leer el permiso. Ahora se distingue: null = no se pudo leer, no "denegado".

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_plugin_ok boolean;

COMMENT ON COLUMN drivers.gps_plugin_ok IS
  'false = la app instalada no puede leer permisos de ubicacion (build vieja, hay que actualizar).';

CREATE OR REPLACE FUNCTION report_gps_status(
  p_location boolean,
  p_background boolean,
  p_notification boolean,
  p_app_version text,
  p_plugin_ok boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE drivers
  SET gps_location_granted = p_location,
      gps_background_granted = p_background,
      gps_notification_granted = p_notification,
      gps_plugin_ok = p_plugin_ok,
      app_version = COALESCE(p_app_version, app_version),
      gps_permission_checked_at = now()
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

GRANT EXECUTE ON FUNCTION report_gps_status(boolean, boolean, boolean, text, boolean) TO authenticated;

-- ═══ Visibilidad del permiso de GPS en background por driver ═══
-- Permite ver desde el TMS qué drivers tienen "Permitir todo el tiempo" concedido.

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_location_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_background_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_notification_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_permission_checked_at timestamptz;

COMMENT ON COLUMN drivers.gps_background_granted IS
  'true = el driver concedio ubicacion en background ("Allow all the time"/"Always"). Sin esto el tracking muere al cerrar la app.';

-- Reporte vía función: no depende del RLS de drivers y solo actualiza al driver logueado
CREATE OR REPLACE FUNCTION report_gps_permissions(p_location boolean, p_background boolean, p_notification boolean)
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
      gps_permission_checked_at = now()
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

GRANT EXECUTE ON FUNCTION report_gps_permissions(boolean, boolean, boolean) TO authenticated;

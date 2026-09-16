-- ═══ Visibilidad del permiso de GPS en background por driver ═══
-- Permite ver desde el TMS qué drivers tienen "Permitir todo el tiempo" concedido.

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_location_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_background_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_notification_granted boolean;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gps_permission_checked_at timestamptz;

COMMENT ON COLUMN drivers.gps_background_granted IS
  'true = el driver concedio ubicacion en background ("Allow all the time"/"Always"). Sin esto el tracking muere al cerrar la app.';

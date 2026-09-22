-- ═══ Llegada por GPS: índice para que no se lea toda la tabla de cargas en cada ubicación ═══
-- La tabla loads pesa ~160 MB (rutas guardadas). Sin índice por driver, cada ubicación
-- de cada driver recorría la tabla completa y saturó la base.

CREATE INDEX IF NOT EXISTS idx_loads_driver_active
  ON loads (driver_id)
  WHERE status IN ('planned', 'dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery');

CREATE INDEX IF NOT EXISTS idx_load_stops_load_id ON load_stops (load_id);

ANALYZE loads;
ANALYZE load_stops;

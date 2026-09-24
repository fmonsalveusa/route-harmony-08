-- ═══ Llegada por GPS: solo la siguiente parada pendiente ═══
-- Caso: una carga que carga en A, entrega en B, vuelve a cargar en A y entrega otra vez en B.
-- Antes, estando en A durante la primera carga, después de 20 minutos el GPS podía marcar
-- también la segunda parada de A. Ahora una parada solo se marca si todas las anteriores
-- ya están marcadas, así que la segunda visita a A no se marca hasta pasar por B.

CREATE OR REPLACE FUNCTION auto_mark_stop_arrival()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today_et date := (now() AT TIME ZONE 'America/New_York')::date;
  s record;
  driver_name text;
BEGIN
  IF COALESCE(NEW.speed, 0) > 6.7 OR COALESCE(NEW.accuracy, 0) > 200 THEN
    RETURN NEW;
  END IF;

  SELECT st.id, st.load_id, st.stop_type, st.address, l.reference_number, l.tenant_id
  INTO s
  FROM loads l
  JOIN load_stops st ON st.load_id = l.id
  WHERE l.driver_id = NEW.driver_id::text
    AND l.status IN ('planned', 'dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery')
    AND st.arrived_at IS NULL
    AND st.lat IS NOT NULL AND st.lng IS NOT NULL
    AND COALESCE(
      CASE WHEN st.date::text ~ '^\d{4}-\d{2}-\d{2}' THEN left(st.date::text, 10)::date END,
      CASE WHEN st.stop_type = 'pickup' THEN l.pickup_date::date ELSE l.delivery_date::date END
    ) BETWEEN today_et - 1 AND today_et + 1
    AND 6371000 * 2 * asin(sqrt(
      power(sin(radians(st.lat - NEW.lat) / 2), 2) +
      cos(radians(NEW.lat)) * cos(radians(st.lat)) * power(sin(radians(st.lng - NEW.lng) / 2), 2)
    )) <= 300
    -- Es la siguiente parada: las anteriores ya están marcadas
    AND NOT EXISTS (
      SELECT 1 FROM load_stops prev
      WHERE prev.load_id = l.id AND prev.stop_order < st.stop_order AND prev.arrived_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM load_stops o
      WHERE o.load_id = l.id AND o.arrived_at > now() - interval '20 minutes'
    )
  ORDER BY st.stop_order
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE load_stops SET arrived_at = now() WHERE id = s.id AND arrived_at IS NULL;
  UPDATE loads
    SET status = CASE WHEN s.stop_type = 'pickup' THEN 'on_site_pickup' ELSE 'on_site_delivery' END
    WHERE id = s.load_id;

  SELECT name INTO driver_name FROM drivers WHERE id::text = NEW.driver_id::text;
  INSERT INTO notifications (tenant_id, type, title, message, load_id, driver_id)
  VALUES (
    s.tenant_id, 'driver_arrived', 'Arrived - ' || COALESCE(driver_name, 'Driver'),
    COALESCE(driver_name, 'Driver') || ' arrived at ' || s.stop_type || ': ' || s.address
      || ' (Load #' || COALESCE(s.reference_number, '') || ') — detectado por GPS',
    s.load_id, NEW.driver_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_stop_arrival: %', SQLERRM;
  RETURN NEW;
END;
$$;

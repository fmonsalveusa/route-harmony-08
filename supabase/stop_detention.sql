-- ═══ Detention por parada ═══
-- El detention se marca en la parada donde ocurrió. La carga hereda las marcas:
--  has_detention_pickup    → alguna parada de pickup con detention
--  has_detention_delivery  → alguna entrega con detention
--  has_detention           → cualquiera de las dos (es la que pone 5DETENTION en Gmail)

ALTER TABLE load_stops ADD COLUMN IF NOT EXISTS has_detention boolean NOT NULL DEFAULT false;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS has_detention_pickup boolean NOT NULL DEFAULT false;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS has_detention_delivery boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION recalc_load_detention(p_load uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pick boolean;
  del boolean;
BEGIN
  SELECT
    COALESCE(bool_or(has_detention) FILTER (WHERE stop_type = 'pickup'), false),
    COALESCE(bool_or(has_detention) FILTER (WHERE stop_type = 'delivery'), false)
  INTO pick, del
  FROM load_stops WHERE load_id = p_load;

  UPDATE loads
    SET has_detention_pickup = pick,
        has_detention_delivery = del,
        has_detention = (pick OR del)
    WHERE id = p_load
      AND (has_detention_pickup IS DISTINCT FROM pick
        OR has_detention_delivery IS DISTINCT FROM del
        OR has_detention IS DISTINCT FROM (pick OR del));
END;
$$;

CREATE OR REPLACE FUNCTION trg_stop_detention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recalc_load_detention(COALESCE(NEW.load_id, OLD.load_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS stop_detention ON load_stops;
CREATE TRIGGER stop_detention
  AFTER INSERT OR DELETE OR UPDATE OF has_detention ON load_stops
  FOR EACH ROW EXECUTE FUNCTION trg_stop_detention();

-- Las cargas que ya tenían la marca a nivel carga pasan a tenerla en todas sus paradas,
-- para no perder lo que ya habías marcado
UPDATE load_stops s SET has_detention = true
WHERE EXISTS (SELECT 1 FROM loads l WHERE l.id = s.load_id AND l.has_detention);

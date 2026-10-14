-- TONU: la carga no se movió, así que las millas cargadas quedan en 0.
-- Se guardan las originales por si la carga sale de TONU (se restauran).
ALTER TABLE loads ADD COLUMN IF NOT EXISTS miles_before_tonu numeric;

CREATE OR REPLACE FUNCTION loads_tonu_miles()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'tonu' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'tonu') THEN
    IF COALESCE(NEW.miles, 0) <> 0 THEN NEW.miles_before_tonu := NEW.miles; END IF;
    NEW.miles := 0;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'tonu' AND NEW.status <> 'tonu' THEN
    IF COALESCE(NEW.miles, 0) = 0 AND NEW.miles_before_tonu IS NOT NULL THEN NEW.miles := NEW.miles_before_tonu; END IF;
    NEW.miles_before_tonu := NULL;
  ELSIF NEW.status = 'tonu' THEN
    -- Sigue en TONU: aunque se edite la carga, las millas cargadas siguen en 0
    IF COALESCE(NEW.miles, 0) <> 0 THEN NEW.miles_before_tonu := NEW.miles; END IF;
    NEW.miles := 0;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_loads_tonu_miles ON loads;
CREATE TRIGGER trg_loads_tonu_miles BEFORE INSERT OR UPDATE OF status, miles ON loads
  FOR EACH ROW EXECUTE FUNCTION loads_tonu_miles();

-- Cargas que ya estaban en TONU
UPDATE loads SET miles_before_tonu = miles, miles = 0 WHERE status = 'tonu' AND COALESCE(miles, 0) <> 0;

-- ═══ Congelar el precio del diésel al entregar la carga ═══
-- Activa    → el profit usa el precio actual del tenant (se recalcula si cambia)
-- Delivered → usa diesel_price_snapshot, guardado al momento de entregar

ALTER TABLE loads ADD COLUMN IF NOT EXISTS diesel_price_snapshot numeric;

CREATE OR REPLACE FUNCTION set_load_diesel_price_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_price numeric;
BEGIN
  SELECT diesel_price_per_gallon INTO current_price
  FROM tenants WHERE id = NEW.tenant_id;

  IF TG_OP = 'INSERT' THEN
    -- Precio de referencia al crear la carga
    NEW.diesel_price_snapshot := current_price;
  ELSIF NEW.status IN ('delivered', 'tonu', 'paid')
        AND COALESCE(OLD.status, '') NOT IN ('delivered', 'tonu', 'paid') THEN
    -- Se congela el precio vigente al momento de entregar
    NEW.diesel_price_snapshot := current_price;
  ELSIF NEW.status NOT IN ('delivered', 'tonu', 'paid', 'cancelled') THEN
    -- Mientras está activa, sigue el precio actual
    NEW.diesel_price_snapshot := current_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_load_diesel_price_snapshot ON loads;
CREATE TRIGGER trg_load_diesel_price_snapshot
  BEFORE INSERT OR UPDATE OF status ON loads
  FOR EACH ROW EXECUTE FUNCTION set_load_diesel_price_snapshot();

-- Cargas ya entregadas: precio de EIA de la semana de entrega si existe; si no, el precio actual
UPDATE loads l
SET diesel_price_snapshot = COALESCE(
  (SELECT dp.price FROM diesel_prices dp
   WHERE dp.region = COALESCE(t.diesel_price_region, 'lower_atlantic')
     AND dp.period <= COALESCE(l.delivery_date::date, l.pickup_date::date)
   ORDER BY dp.period DESC LIMIT 1),
  t.diesel_price_per_gallon
)
FROM tenants t
WHERE t.id = l.tenant_id
  AND l.status IN ('delivered', 'tonu', 'paid')
  AND l.diesel_price_snapshot IS NULL;

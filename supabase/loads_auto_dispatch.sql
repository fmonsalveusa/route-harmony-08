-- Auto-dispatch: una carga Planned marcada con auto_dispatch pasa sola a Dispatched cuando el
-- driver termina su carga activa (Delivered o TONU) y no le queda otra carga en curso.
-- Si el driver tiene varias planeadas, pasa la de pickup más temprano. El aviso de WhatsApp
-- de Dispatched sale igual que siempre (trigger load_whatsapp_notify).
ALTER TABLE loads ADD COLUMN IF NOT EXISTS auto_dispatch boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION loads_auto_dispatch_next()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  nxt record;
  drv text;
BEGIN
  IF NEW.status NOT IN ('delivered', 'tonu') OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.driver_id IS NULL OR NEW.driver_id = '' THEN
    RETURN NEW;
  END IF;

  -- Todavía tiene otra carga en curso: se espera a que termine esa
  IF EXISTS (
    SELECT 1 FROM loads
    WHERE driver_id = NEW.driver_id AND id <> NEW.id
      AND status IN ('dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id, reference_number, origin, destination, tenant_id INTO nxt FROM loads
  WHERE driver_id = NEW.driver_id AND id <> NEW.id AND status = 'planned' AND auto_dispatch
  ORDER BY pickup_date NULLS LAST, created_at
  LIMIT 1;
  IF nxt.id IS NULL THEN RETURN NEW; END IF;

  UPDATE loads SET status = 'dispatched', auto_dispatch = false WHERE id = nxt.id;

  SELECT name INTO drv FROM drivers WHERE id::text = NEW.driver_id;
  INSERT INTO notifications (type, title, message, load_id, driver_id, is_read, tenant_id)
  VALUES ('status_changed', 'Auto-dispatch - ' || COALESCE(drv, 'Driver'),
          COALESCE(drv, 'Driver') || ' | Load #' || COALESCE(nxt.reference_number, '') || ' pasó a Dispatched al entregar #'
            || COALESCE(NEW.reference_number, '') || ' | ' || COALESCE(nxt.origin, '') || ' → ' || COALESCE(nxt.destination, ''),
          nxt.id, NEW.driver_id, false, nxt.tenant_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'loads_auto_dispatch_next: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_loads_auto_dispatch ON loads;
CREATE TRIGGER trg_loads_auto_dispatch
  AFTER UPDATE OF status ON loads
  FOR EACH ROW EXECUTE FUNCTION loads_auto_dispatch_next();

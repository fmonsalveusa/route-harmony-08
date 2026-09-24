-- ═══ Etiquetas del hilo de Gmail según el estado de la carga ═══
--  planned                        → 3PENDIENTE
--  dispatched, in_transit, etc.   → 1ACTIVE
--  delivered, paid, tonu          → 2ENTREGADA
--  cancelled                      → 4CANCELADA
-- Además se le pone la etiqueta con el nombre del driver asignado.

-- Guarda qué etiquetas puso el sistema, para quitar solo esas al cambiar de estado o de driver
ALTER TABLE load_email_threads ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION trg_load_sync_email_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR COALESCE(NEW.driver_id, '') IS DISTINCT FROM COALESCE(OLD.driver_id, '') THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
      body := jsonb_build_object('event', 'labels', 'load_id', NEW.id),
      timeout_milliseconds := 60000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS load_sync_email_labels ON loads;
CREATE TRIGGER load_sync_email_labels
  AFTER UPDATE OF status, driver_id ON loads
  FOR EACH ROW EXECUTE FUNCTION trg_load_sync_email_labels();

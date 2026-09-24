-- ═══ Marca de detention en la carga ═══
-- Convive con el estado: una carga puede estar 1ACTIVE o 2ENTREGADA y además tener
-- detention pendiente de reclamar. Al marcarla, el hilo de Gmail recibe 5DETENTION.

ALTER TABLE loads ADD COLUMN IF NOT EXISTS has_detention boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION trg_load_sync_email_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR COALESCE(NEW.driver_id, '') IS DISTINCT FROM COALESCE(OLD.driver_id, '')
     OR NEW.has_detention IS DISTINCT FROM OLD.has_detention THEN
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
  AFTER UPDATE OF status, driver_id, has_detention ON loads
  FOR EACH ROW EXECUTE FUNCTION trg_load_sync_email_labels();

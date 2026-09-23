-- ═══ Al crear una carga: buscar su hilo de Gmail y avisar si no se pudo enlazar ═══
-- Si el hilo no aparece, o hay más de uno con el mismo número, sale un aviso en el TMS
-- para enlazarlo a mano antes de que haya que mandar el primer email.

CREATE OR REPLACE FUNCTION trg_load_link_email_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.reference_number, '') <> ''
     AND NEW.status <> 'cancelled'
     AND (TG_OP = 'INSERT' OR NEW.reference_number IS DISTINCT FROM OLD.reference_number) THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
      body := jsonb_build_object('event', 'link_check', 'load_id', NEW.id),
      timeout_milliseconds := 60000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS load_link_email_thread ON loads;
CREATE TRIGGER load_link_email_thread
  AFTER INSERT OR UPDATE OF reference_number ON loads
  FOR EACH ROW EXECUTE FUNCTION trg_load_link_email_thread();

-- ═══ "Carga asignada" no se envía mientras la carga está en PLANNED ═══
-- Se envía al crear la carga en un status activo, al cambiar el driver de una carga activa,
-- o cuando la carga sale de PLANNED (por ejemplo a DISPATCHED).

CREATE OR REPLACE FUNCTION trg_load_whatsapp_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url constant text := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/load-whatsapp-notify';
  fn_headers constant jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'
  );
BEGIN
  -- Carga asignada: solo en status activos (no planned ni terminados)
  IF NEW.driver_id IS NOT NULL
     AND NEW.status NOT IN ('planned', 'cancelled', 'delivered', 'tonu', 'paid')
     AND NEW.driver_id::text IS DISTINCT FROM NEW.whatsapp_assigned_driver_id
     AND (
       TG_OP = 'INSERT'
       OR NEW.driver_id::text IS DISTINCT FROM OLD.driver_id::text
       OR OLD.status = 'planned'
     ) THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := fn_headers,
      body := jsonb_build_object('load_id', NEW.id, 'event', 'assigned')
    );
  END IF;

  -- Carga entregada
  IF NEW.status = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.whatsapp_delivered_sent_at IS NULL THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := fn_headers,
      body := jsonb_build_object('load_id', NEW.id, 'event', 'delivered')
    );
  END IF;

  RETURN NEW;
END;
$$;

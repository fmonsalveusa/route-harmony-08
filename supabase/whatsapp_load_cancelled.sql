-- ═══ WhatsApp: aviso cuando una carga se cancela ═══
-- Solo se envía si a ese driver ya se le había avisado que la carga era suya.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_load_cancelled boolean NOT NULL DEFAULT true;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS whatsapp_cancelled_sent_at timestamptz;

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

  -- Carga cancelada (la función revisa que al driver ya se le hubiera avisado)
  IF NEW.status = 'cancelled'
     AND TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NEW.whatsapp_cancelled_sent_at IS NULL THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := fn_headers,
      body := jsonb_build_object('load_id', NEW.id, 'event', 'cancelled')
    );
  END IF;

  RETURN NEW;
END;
$$;

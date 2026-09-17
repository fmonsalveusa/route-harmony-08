-- ═══ Mensajes de WhatsApp al grupo del driver ═══
-- Se envía al asignar la carga a un driver y al marcarla Delivered.
-- Requiere pg_net (ya activo) y el secreto CRON_SECRET configurado en la Edge Function.

-- 1. Grupo de WhatsApp de cada driver
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS whatsapp_group_name text;

-- 2. Control de envíos por carga (evita mensajes duplicados)
ALTER TABLE loads ADD COLUMN IF NOT EXISTS whatsapp_assigned_driver_id text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS whatsapp_assigned_sent_at timestamptz;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS whatsapp_delivered_sent_at timestamptz;

-- 3. Trigger que llama a la Edge Function
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
  -- Carga asignada a un driver que todavía no fue notificado
  IF NEW.driver_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.driver_id::text IS DISTINCT FROM OLD.driver_id::text)
     AND NEW.driver_id::text IS DISTINCT FROM NEW.whatsapp_assigned_driver_id THEN
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

DROP TRIGGER IF EXISTS load_whatsapp_notify ON loads;
CREATE TRIGGER load_whatsapp_notify
  AFTER INSERT OR UPDATE OF driver_id, status ON loads
  FOR EACH ROW EXECUTE FUNCTION trg_load_whatsapp_notify();

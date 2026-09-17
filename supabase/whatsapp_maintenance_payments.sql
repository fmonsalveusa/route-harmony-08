-- ═══ WhatsApp: avisos de mantenimiento y recibos de pago ═══

-- 1. Grupo de WhatsApp de investors y dispatchers
ALTER TABLE investors ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS whatsapp_group_name text;
ALTER TABLE dispatchers ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
ALTER TABLE dispatchers ADD COLUMN IF NOT EXISTS whatsapp_group_name text;

-- 2. Mantenimiento: último aviso enviado en el ciclo de servicio actual
ALTER TABLE truck_maintenance ADD COLUMN IF NOT EXISTS whatsapp_notified_status text;

-- Máximo un aviso de Approaching y uno de Overdue por ciclo.
-- El ciclo se reinicia cuando se registra un servicio nuevo (cambia last_performed_at).
CREATE OR REPLACE FUNCTION trg_maintenance_whatsapp_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rank_new int := CASE NEW.status WHEN 'due' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END;
  rank_sent int;
BEGIN
  IF NEW.last_performed_at IS DISTINCT FROM OLD.last_performed_at THEN
    NEW.whatsapp_notified_status := NULL;
  END IF;

  rank_sent := CASE NEW.whatsapp_notified_status WHEN 'due' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END;

  IF rank_new > rank_sent THEN
    NEW.whatsapp_notified_status := NEW.status;
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/maintenance-whatsapp-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'
      ),
      body := jsonb_build_object('maintenance_id', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maintenance_whatsapp_notify ON truck_maintenance;
CREATE TRIGGER maintenance_whatsapp_notify
  BEFORE UPDATE OF status, last_performed_at ON truck_maintenance
  FOR EACH ROW EXECUTE FUNCTION trg_maintenance_whatsapp_notify();

-- Los mantenimientos que YA están en warning/due quedan marcados como avisados,
-- para no mandar una ráfaga de mensajes al activar esto
UPDATE truck_maintenance
SET whatsapp_notified_status = status
WHERE status IN ('warning', 'due') AND whatsapp_notified_status IS NULL;

-- ═══ WhatsApp: POD, recordatorios diarios, reporte de administración y vencimientos ═══

-- 1. Configuración por tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_admin_group_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_admin_group_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_pod_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_daily_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_admin_report boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_expiry_alerts boolean NOT NULL DEFAULT true;

-- 2. Registro de mensajes enviados (evita duplicados si un job corre dos veces)
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  message_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE whatsapp_message_log TO service_role;

-- 3. POD: cuándo se entregó y recordatorios enviados
ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_reminder_count integer NOT NULL DEFAULT 0;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION set_load_delivered_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at := now();
    NEW.pod_reminder_count := 0;
    NEW.pod_reminder_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_load_delivered_at ON loads;
CREATE TRIGGER trg_set_load_delivered_at
  BEFORE INSERT OR UPDATE OF status ON loads
  FOR EACH ROW EXECUTE FUNCTION set_load_delivered_at();

-- 4. Al subir un documento a una carga entregada, reintentar el mensaje de "completada"
--    (la función solo lo envía si ya hay POD y todavía no se había enviado)
CREATE OR REPLACE FUNCTION trg_pod_uploaded_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM loads
    WHERE id::text = NEW.load_id::text
      AND status = 'delivered'
      AND delivered_at IS NOT NULL
      AND whatsapp_delivered_sent_at IS NULL
  ) THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/load-whatsapp-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'
      ),
      body := jsonb_build_object('load_id', NEW.load_id, 'event', 'delivered')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pod_uploaded_whatsapp ON pod_documents;
CREATE TRIGGER pod_uploaded_whatsapp
  AFTER INSERT ON pod_documents
  FOR EACH ROW EXECUTE FUNCTION trg_pod_uploaded_whatsapp();

-- 5. Jobs programados
--    Recordatorios de POD: cada hora
--    Recordatorios del día, vencimientos y reporte: 11:00 UTC = 7:00 am Eastern en horario de verano
--    (6:00 am en horario de invierno)
SELECT cron.unschedule('whatsapp-pod-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-pod-reminders');
SELECT cron.unschedule('whatsapp-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-daily');

SELECT cron.schedule(
  'whatsapp-pod-reminders',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"pod"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'whatsapp-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"daily"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

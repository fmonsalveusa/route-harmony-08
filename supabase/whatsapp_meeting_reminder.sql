-- ═══ WhatsApp: recordatorio 15 minutos antes de las reuniones de la landing ═══

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_meetings_group_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_meetings_group_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_meeting_reminder boolean NOT NULL DEFAULT true;

-- Revisa cada 5 minutos si hay una reunión en los próximos 15 minutos
SELECT cron.unschedule('whatsapp-meeting-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-meeting-reminders');

SELECT cron.schedule(
  'whatsapp-meeting-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"meetings"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

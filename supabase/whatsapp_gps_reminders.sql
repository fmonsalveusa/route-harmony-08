-- Aviso diario por WhatsApp a drivers sin GPS en segundo plano
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_gps_reminders boolean NOT NULL DEFAULT true;

-- 9:00 am Eastern (13 y 14 UTC; la función solo envía cuando en Eastern son las 9)
SELECT cron.unschedule('whatsapp-gps') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-gps');
SELECT cron.schedule('whatsapp-gps', '0 13,14 * * *',
  (SELECT replace(command, '"job":"daily"', '"job":"gps"') FROM cron.job WHERE jobname = 'whatsapp-daily'));

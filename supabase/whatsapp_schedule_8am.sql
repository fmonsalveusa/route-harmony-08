-- ═══ Horarios de WhatsApp en hora del Este (verano e invierno) ═══
-- Cada job corre en las dos horas UTC posibles; la función solo envía a la hora Eastern correcta.
--   Recordatorios del día y vencimientos: 7:00 am Eastern  → 11:00 y 12:00 UTC
--   Reporte de administración:           8:00 am Eastern  → 12:00 y 13:00 UTC

SELECT cron.unschedule('whatsapp-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-daily');
SELECT cron.unschedule('whatsapp-admin-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-admin-report');

SELECT cron.schedule(
  'whatsapp-daily',
  '0 11,12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"daily"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'whatsapp-admin-report',
  '0 12,13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"admin_report"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

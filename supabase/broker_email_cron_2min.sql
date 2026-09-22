-- ═══ Emails al broker: revisar la cola cada 2 minutos ═══
-- El email de documentos espera 3 minutos sin archivos nuevos; con la revisión cada 5
-- se le sumaba demasiada espera.

SELECT cron.unschedule('broker-email-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'broker-email-queue');

SELECT cron.schedule(
  'broker-email-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"event":"process"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

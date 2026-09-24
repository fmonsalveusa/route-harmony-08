-- ═══ Emails al broker: revisar la cola cada 10 minutos ═══
-- Los emails salen en el momento (llegada del driver y botón de la parada). Esta tarea
-- solo reintenta los que no pudieron salir, casi siempre por falta del hilo de Gmail.

SELECT cron.unschedule('broker-email-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'broker-email-queue');

SELECT cron.schedule(
  'broker-email-queue',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"event":"process"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

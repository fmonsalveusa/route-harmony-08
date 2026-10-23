-- ═══ Odómetro desde el ELD: todos los días a las 12:00 pm (hora del Este) ═══
-- pg_cron trabaja en UTC y las 12:00 pm del Este son 16:00 UTC en verano y 17:00 UTC en
-- invierno. El job corre a las dos horas y solo llama a la función cuando en el Este son
-- las 12, así sigue a mediodía después del cambio de horario.

SELECT cron.unschedule('eld-odometer') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eld-odometer');

SELECT cron.schedule(
  'eld-odometer',
  '0 16,17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/eld-odometer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"job":"sync"}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE extract(hour FROM now() AT TIME ZONE 'America/New_York') = 12;
  $$
);

SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'eld-odometer';

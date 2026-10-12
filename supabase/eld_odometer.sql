-- ═══ Odómetro automático desde HOS247 y RouteOne ═══
-- La función eld-odometer entra a cada portal con los secretos
--   HOS247_EMAIL, HOS247_PASSWORD, ROUTEONE_LOGIN, ROUTEONE_PASSWORD
-- y actualiza el odómetro de los camiones con mantenimientos recurrentes.
-- Dos veces al día: 6:00 am y 6:00 pm Eastern (aprox., horario de verano).
SELECT cron.unschedule('eld-odometer') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eld-odometer');
SELECT cron.schedule('eld-odometer', '0 10,22 * * *',
  (SELECT replace(replace(command, '/functions/v1/whatsapp-jobs', '/functions/v1/eld-odometer'), '"job":"daily"', '"job":"sync"')
   FROM cron.job WHERE jobname = 'whatsapp-daily'));

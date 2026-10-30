-- ═══ Mantenimiento en DUE: aviso diario al driver a las 8:30 am (hora del Este) ═══
-- pg_cron trabaja en UTC: 8:30 am del Este son 12:30 UTC en verano y 13:30 UTC en invierno.
-- La función solo envía cuando en el Este son las 8, así que corre en las dos horas.
-- El comando se copia del job whatsapp-daily cambiando solo el nombre del job.

SELECT cron.unschedule('whatsapp-maintenance-due') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-maintenance-due');

SELECT cron.schedule(
  'whatsapp-maintenance-due',
  '30 12,13 * * *',
  (SELECT replace(command, '{"job":"daily"}', '{"job":"maintenance_due"}') FROM cron.job WHERE jobname = 'whatsapp-daily')
);

SELECT jobname, schedule, active, position('maintenance_due' in command) > 0 AS ok FROM cron.job WHERE jobname = 'whatsapp-maintenance-due';

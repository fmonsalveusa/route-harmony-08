-- ═══ VACUUM FULL de loads, programado una sola vez ═══
-- El editor SQL no deja correr VACUUM porque envuelve todo en una transacción.
-- pg_cron sí puede: se agenda para las 3:00 am del Este (07:00 UTC) y después se borra.
-- Bloquea la tabla unos segundos mientras corre, por eso va de madrugada.

-- ─── 1. Agendar ───
SELECT cron.unschedule('vacuum-loads-once') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vacuum-loads-once');

SELECT cron.schedule('vacuum-loads-once', '0 7 * * *', 'VACUUM FULL loads');

-- ─── 2. Al día siguiente: ver si corrió bien ───
-- SELECT j.jobname, r.status, r.return_message, r.start_time, r.end_time
-- FROM cron.job_run_details r JOIN cron.job j ON j.jobid = r.jobid
-- WHERE j.jobname = 'vacuum-loads-once' ORDER BY r.start_time DESC LIMIT 5;

-- ─── 3. Y borrar la tarea para que no se repita todos los días ───
-- SELECT cron.unschedule('vacuum-loads-once');
-- ANALYZE loads;
-- SELECT pg_size_pretty(pg_total_relation_size('loads')) AS tamano_nuevo;

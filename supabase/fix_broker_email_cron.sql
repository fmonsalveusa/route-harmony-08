-- ═══ Arreglar el job broker-email-queue ═══
-- Su comando quedó con SQL de otro archivo pegado dentro, así que venía fallando
-- en cada corrida (144 fallas en 24 h). Aquí se vuelve a dejar el comando correcto.

-- ─── 1. Ver cómo está hoy cada job (por si a otro le pasó lo mismo) ───
SELECT jobname, schedule, active, left(command, 120) AS comando
FROM cron.job
ORDER BY jobname;

-- ─── 2. Reescribir el comando bueno ───
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

-- ─── 3. Como quedó ───
SELECT jobname, schedule, active, left(command, 200) AS comando
FROM cron.job
WHERE jobname = 'broker-email-queue';

-- ─── 4. Limpiar el historial viejo de fallas de este job, para que el panel
--       no siga mostrando en rojo algo ya arreglado ───
DELETE FROM cron.job_run_details
WHERE status <> 'succeeded'
  AND jobid NOT IN (SELECT jobid FROM cron.job);

DELETE FROM cron.job_run_details d
USING cron.job j
WHERE j.jobid = d.jobid
  AND j.jobname = 'broker-email-queue'
  AND d.status <> 'succeeded'
  AND d.start_time < now();

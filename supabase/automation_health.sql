-- ═══ Estado de los automatismos ═══
-- Una sola función de lectura que junta todo lo que corre solo: los trabajos agendados
-- (cron), la cola de emails al broker, los avisos de WhatsApp y los hilos de Gmail
-- que quedaron sin enlazar. No escribe nada, no borra nada.

CREATE OR REPLACE FUNCTION automation_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resultado jsonb;
BEGIN
  -- Solo usuarios con sesión. El editor de SQL entra como postgres y no tiene sesión,
  -- así que se le deja pasar para poder probar la función desde ahí.
  IF auth.uid() IS NULL AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH
  -- ─── Trabajos agendados y su última corrida ───
  fallas AS (
    SELECT jobid, count(*) AS fallas_24h
    FROM cron.job_run_details
    WHERE status <> 'succeeded' AND start_time > now() - interval '24 hours'
    GROUP BY jobid
  ),
  jobs AS (
    SELECT jsonb_agg(x ORDER BY x->>'jobname') AS data
    FROM (
      SELECT jsonb_build_object(
        'jobname', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'last_run', u.start_time,
        'last_status', u.status,
        'last_error', CASE WHEN u.status <> 'succeeded' THEN left(u.return_message, 300) END,
        'failures_24h', COALESCE(f.fallas_24h, 0)
      ) AS x
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT d.status, d.start_time, d.return_message
        FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
        ORDER BY d.start_time DESC
        LIMIT 1
      ) u ON true
      LEFT JOIN fallas f ON f.jobid = j.jobid
    ) s
  ),

  -- ─── Emails al broker: últimos 7 días ───
  email_conteo AS (
    SELECT status, count(*) AS n
    FROM broker_email_queue
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
  ),
  email_pegados AS (
    SELECT count(*) AS n
    FROM broker_email_queue
    WHERE status IN ('pending', 'waiting_thread')
      AND send_after < now() - interval '1 hour'
  ),
  email_fallas AS (
    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) AS data
    FROM (
      SELECT jsonb_build_object(
        'reference', l.reference_number,
        'kind', q.kind,
        'stop_type', q.stop_type,
        'attempts', q.attempts,
        'status', q.status,
        'error', left(q.error, 200),
        'created_at', q.created_at
      ) AS x, q.created_at
      FROM broker_email_queue q
      LEFT JOIN loads l ON l.id = q.load_id
      WHERE q.status IN ('failed', 'skipped')
        AND q.created_at > now() - interval '7 days'
      ORDER BY q.created_at DESC
      LIMIT 10
    ) s
  ),
  email_ultimo AS (
    SELECT max(sent_at) AS ts FROM broker_email_queue WHERE status = 'sent'
  ),

  -- ─── WhatsApp: últimos 7 días ───
  wa_conteo AS (
    SELECT status, count(*) AS n
    FROM whatsapp_message_history
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
  ),
  wa_fallas AS (
    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) AS data
    FROM (
      SELECT jsonb_build_object(
        'template_key', h.template_key,
        'recipient_name', h.recipient_name,
        'reference', h.reference,
        'error', left(h.error, 200),
        'created_at', h.created_at
      ) AS x, h.created_at
      FROM whatsapp_message_history h
      WHERE h.status = 'failed' AND h.created_at > now() - interval '7 days'
      ORDER BY h.created_at DESC
      LIMIT 10
    ) s
  ),
  wa_ultimo AS (
    SELECT max(created_at) AS ts FROM whatsapp_message_history WHERE status = 'sent'
  ),

  -- ─── Cargas activas cuyo hilo de Gmail no se pudo enlazar ───
  hilos AS (
    SELECT jsonb_agg(x ORDER BY x->>'reference') AS data
    FROM (
      SELECT jsonb_build_object(
        'reference', l.reference_number,
        'status', l.status,
        'thread_status', COALESCE(t.status, 'sin buscar')
      ) AS x, l.reference_number
      FROM loads l
      LEFT JOIN load_email_threads t ON t.load_id = l.id
      LEFT JOIN drivers d ON d.id::text = l.driver_id
      WHERE l.status NOT IN ('delivered', 'paid', 'cancelled', 'tonu')
        AND COALESCE(d.service_type, '') <> 'dispatch_service'
        AND COALESCE(t.status, 'sin buscar') <> 'linked'
      ORDER BY l.reference_number
      LIMIT 20
    ) s
  )

  SELECT jsonb_build_object(
    'generated_at', now(),
    'jobs', COALESCE((SELECT data FROM jobs), '[]'::jsonb),
    'broker_email', jsonb_build_object(
      'counts', COALESCE((SELECT jsonb_object_agg(status, n) FROM email_conteo), '{}'::jsonb),
      'stuck', (SELECT n FROM email_pegados),
      'last_sent', (SELECT ts FROM email_ultimo),
      'failures', COALESCE((SELECT data FROM email_fallas), '[]'::jsonb)
    ),
    'whatsapp', jsonb_build_object(
      'counts', COALESCE((SELECT jsonb_object_agg(status, n) FROM wa_conteo), '{}'::jsonb),
      'last_sent', (SELECT ts FROM wa_ultimo),
      'failures', COALESCE((SELECT data FROM wa_fallas), '[]'::jsonb)
    ),
    'unlinked_threads', COALESCE((SELECT data FROM hilos), '[]'::jsonb)
  ) INTO resultado;

  RETURN resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION automation_health() TO authenticated;

-- Probarla
SELECT automation_health();

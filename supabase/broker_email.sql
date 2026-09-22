-- ═══ Emails automáticos al broker (respuesta en el hilo de Gmail de la carga) ═══
-- 1) Llegada automática por GPS: cada ubicación del driver se compara con sus paradas pendientes.
-- 2) Al marcarse la llegada (GPS o manual) → email "llegó y espera".
-- 3) Al subir fotos/BOL/POD a una parada → email con adjuntos (espera 10 min para juntar todo).

-- ─── Interruptores ───
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_broker_arrival boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_broker_docs boolean NOT NULL DEFAULT true;

-- ─── Hilo de Gmail de cada carga ───
CREATE TABLE IF NOT EXISTS load_email_threads (
  load_id uuid PRIMARY KEY REFERENCES loads(id) ON DELETE CASCADE,
  tenant_id uuid,
  status text NOT NULL,              -- linked | ambiguous | not_found
  link_mode text,                    -- auto | manual
  account text,                      -- cuenta de Gmail donde está el hilo
  thread_id text,                    -- X-GM-THRID
  subject text,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  searched_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE load_email_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read" ON load_email_threads;
CREATE POLICY "tenant_read" ON load_email_threads FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
GRANT SELECT ON TABLE load_email_threads TO authenticated;
GRANT ALL ON TABLE load_email_threads TO service_role;

-- ─── Cola / historial de emails ───
CREATE TABLE IF NOT EXISTS broker_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  load_id uuid REFERENCES loads(id) ON DELETE CASCADE,
  kind text NOT NULL,                -- arrival | docs
  stop_type text NOT NULL,
  stop_order int NOT NULL,
  city text,
  message_key text NOT NULL UNIQUE,  -- por número de parada (los ids cambian al editar la carga)
  status text NOT NULL DEFAULT 'pending',  -- pending | waiting_thread | sent | failed | skipped
  send_after timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  body text,
  recipients text,
  attachments text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_email_queue_status ON broker_email_queue (status, send_after);
CREATE INDEX IF NOT EXISTS idx_broker_email_queue_load ON broker_email_queue (load_id);

ALTER TABLE broker_email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read" ON broker_email_queue;
CREATE POLICY "tenant_read" ON broker_email_queue FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
GRANT SELECT ON TABLE broker_email_queue TO authenticated;
GRANT ALL ON TABLE broker_email_queue TO service_role;

-- ─── 1) Llegada automática por GPS ───
-- Reglas contra falsas llegadas:
--  • dentro de 300 m de la parada, a menos de ~15 mph y con precisión GPS aceptable
--  • la parada es de hoy, ayer o mañana (evita marcar la carga de la próxima semana en el mismo shipper)
--  • no se marcó otra parada de la misma carga en los últimos 20 min (paradas con la misma dirección)
CREATE OR REPLACE FUNCTION auto_mark_stop_arrival()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today_et date := (now() AT TIME ZONE 'America/New_York')::date;
  s record;
  driver_name text;
BEGIN
  IF COALESCE(NEW.speed, 0) > 6.7 OR COALESCE(NEW.accuracy, 0) > 200 THEN
    RETURN NEW;
  END IF;

  SELECT st.id, st.load_id, st.stop_type, st.address, l.reference_number, l.tenant_id
  INTO s
  FROM loads l
  JOIN load_stops st ON st.load_id = l.id
  WHERE l.driver_id = NEW.driver_id::text
    AND l.status IN ('planned', 'dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery')
    AND st.arrived_at IS NULL
    AND st.lat IS NOT NULL AND st.lng IS NOT NULL
    AND COALESCE(
      CASE WHEN st.date::text ~ '^\d{4}-\d{2}-\d{2}' THEN left(st.date::text, 10)::date END,
      CASE WHEN st.stop_type = 'pickup' THEN l.pickup_date::date ELSE l.delivery_date::date END
    ) BETWEEN today_et - 1 AND today_et + 1
    AND 6371000 * 2 * asin(sqrt(
      power(sin(radians(st.lat - NEW.lat) / 2), 2) +
      cos(radians(NEW.lat)) * cos(radians(st.lat)) * power(sin(radians(st.lng - NEW.lng) / 2), 2)
    )) <= 300
    AND NOT EXISTS (
      SELECT 1 FROM load_stops o
      WHERE o.load_id = l.id AND o.arrived_at > now() - interval '20 minutes'
    )
  ORDER BY st.stop_order
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE load_stops SET arrived_at = now() WHERE id = s.id AND arrived_at IS NULL;
  UPDATE loads
    SET status = CASE WHEN s.stop_type = 'pickup' THEN 'on_site_pickup' ELSE 'on_site_delivery' END
    WHERE id = s.load_id;

  SELECT name INTO driver_name FROM drivers WHERE id::text = NEW.driver_id::text;
  INSERT INTO notifications (tenant_id, type, title, message, load_id, driver_id)
  VALUES (
    s.tenant_id, 'driver_arrived', 'Arrived - ' || COALESCE(driver_name, 'Driver'),
    COALESCE(driver_name, 'Driver') || ' arrived at ' || s.stop_type || ': ' || s.address
      || ' (Load #' || COALESCE(s.reference_number, '') || ') — detectado por GPS',
    s.load_id, NEW.driver_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear el guardado de la ubicación
  RAISE WARNING 'auto_mark_stop_arrival: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_location_auto_arrival ON driver_locations;
CREATE TRIGGER driver_location_auto_arrival
  AFTER INSERT OR UPDATE OF lat, lng ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION auto_mark_stop_arrival();

-- ─── 2) Llegada marcada (GPS o manual) → email "llegó y espera" ───
CREATE OR REPLACE FUNCTION trg_stop_arrival_broker_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.arrived_at IS NULL AND NEW.arrived_at IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
      body := jsonb_build_object('event', 'arrival', 'stop_id', NEW.id),
      timeout_milliseconds := 60000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stop_arrival_broker_email ON load_stops;
CREATE TRIGGER stop_arrival_broker_email
  AFTER UPDATE OF arrived_at ON load_stops
  FOR EACH ROW EXECUTE FUNCTION trg_stop_arrival_broker_email();

-- ─── 3) Fotos / BOL / POD en una parada → email con adjuntos ───
CREATE OR REPLACE FUNCTION trg_pod_uploaded_broker_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stop_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
      body := jsonb_build_object('event', 'docs', 'stop_id', NEW.stop_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pod_uploaded_broker_email ON pod_documents;
CREATE TRIGGER pod_uploaded_broker_email
  AFTER INSERT ON pod_documents
  FOR EACH ROW EXECUTE FUNCTION trg_pod_uploaded_broker_email();

-- ─── Procesar la cola cada 5 minutos (docs pendientes y reintentos) ───
SELECT cron.unschedule('broker-email-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'broker-email-queue');

SELECT cron.schedule(
  'broker-email-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/broker-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
    body := '{"event":"process"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

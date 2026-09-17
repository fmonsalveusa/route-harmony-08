-- ═══ WhatsApp: documentos recibidos en paradas intermedias ═══
-- Apenas se sube un BOL/POD en PDF a una parada, se avisa al grupo del driver.
-- La función decide si es parada intermedia (la entrega final la cubre "carga completada").

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_stop_docs boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION trg_pod_uploaded_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fn_url constant text := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/load-whatsapp-notify';
  fn_headers constant jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'
  );
BEGIN
  -- BOL/POD en PDF en una parada → aviso de documento recibido
  IF NEW.stop_id IS NOT NULL AND COALESCE(NEW.file_type, '') <> 'image' THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := fn_headers,
      body := jsonb_build_object('event', 'stop_document', 'stop_id', NEW.stop_id)
    );
  END IF;

  -- Carga entregada que esperaba POD → reintentar "carga completada"
  IF EXISTS (
    SELECT 1 FROM loads
    WHERE id::text = NEW.load_id::text
      AND status = 'delivered'
      AND delivered_at IS NOT NULL
      AND whatsapp_delivered_sent_at IS NULL
  ) THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := fn_headers,
      body := jsonb_build_object('load_id', NEW.load_id, 'event', 'delivered')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pod_uploaded_whatsapp ON pod_documents;
CREATE TRIGGER pod_uploaded_whatsapp
  AFTER INSERT ON pod_documents
  FOR EACH ROW EXECUTE FUNCTION trg_pod_uploaded_whatsapp();

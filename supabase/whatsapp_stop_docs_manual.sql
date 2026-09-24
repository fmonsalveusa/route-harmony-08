-- ═══ El "gracias" al driver pasa a salir con el botón, no al subir el archivo ═══
-- Antes se disparaba al subir el BOL/POD en PDF. Ahora lo dispara "PICK UP COMPLETED" /
-- "DELIVERY COMPLETED" de la app (o el botón de enviar al broker del TMS), que es cuando
-- el driver da la parada por terminada. El disparador de pod_documents solo conserva el
-- reintento del mensaje de "carga completada".

CREATE OR REPLACE FUNCTION trg_pod_uploaded_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Carga entregada que esperaba POD → reintentar "carga completada"
  IF EXISTS (
    SELECT 1 FROM loads
    WHERE id::text = NEW.load_id::text
      AND status = 'delivered'
      AND delivered_at IS NOT NULL
      AND whatsapp_delivered_sent_at IS NULL
  ) THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/load-whatsapp-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'
      ),
      body := jsonb_build_object('load_id', NEW.load_id, 'event', 'delivered')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ═══ Documento de firma completado: aviso en el TMS y WhatsApp ═══
-- Al terminar de firmarse un documento de la sección Documents, se avisa al grupo de
-- administración y al grupo del driver que firmó.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_document_signed boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION trg_document_signed_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- En un INSERT no hay OLD, por eso se revisa TG_OP antes de compararlo
  IF NEW.status = 'signed' AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') <> 'signed') THEN
    PERFORM net.http_post(
      url := 'https://tejzatzzwivvaznxyqej.supabase.co/functions/v1/whatsapp-jobs',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '58ed8596ade92b0d04e168a87a27927ada35197f2937fbc9'),
      body := jsonb_build_object('job', 'document_signed', 'document_id', NEW.id),
      timeout_milliseconds := 30000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_signed_notify ON documents;
CREATE TRIGGER document_signed_notify
  AFTER INSERT OR UPDATE OF status ON documents
  FOR EACH ROW EXECUTE FUNCTION trg_document_signed_notify();

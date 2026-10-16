-- Documento de firma → POD de una carga.
-- Se vincula el documento a una carga (y a una entrega por su número de parada, porque al
-- editar la carga las paradas se recrean con ids nuevos). Cuando el documento queda firmado,
-- el PDF firmado se agrega a esa parada como POD (pod_documents) y viaja en el email al broker
-- con "Delivery Completed", junto con las fotos de la parada.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pod_load_id uuid REFERENCES loads(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pod_stop_order integer;        -- null = última entrega
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pod_document_id uuid;          -- POD ya creado

CREATE OR REPLACE FUNCTION documents_attach_pod()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  stop_id uuid;
  new_id uuid;
BEGIN
  IF NEW.status <> 'signed' OR NEW.pod_load_id IS NULL OR NEW.pod_document_id IS NOT NULL
     OR NEW.signed_file_data IS NULL OR NEW.signed_file_data LIKE 'data:%' THEN
    RETURN NEW;
  END IF;

  SELECT id, reference_number, tenant_id INTO l FROM loads WHERE id = NEW.pod_load_id;
  IF l.id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO stop_id FROM load_stops s
  WHERE s.load_id = l.id AND s.stop_type = 'delivery'
    AND (NEW.pod_stop_order IS NULL OR s.stop_order = NEW.pod_stop_order)
  ORDER BY s.stop_order DESC LIMIT 1;

  INSERT INTO pod_documents (load_id, stop_id, file_url, file_name, file_type, tenant_id)
  VALUES (l.id, stop_id, NEW.signed_file_data,
          'POD #' || COALESCE(l.reference_number, '') || ' - ' || regexp_replace(COALESCE(NEW.file_name, 'documento'), '\.pdf$', '', 'i') || '.pdf',
          'pdf', l.tenant_id)
  RETURNING id INTO new_id;

  UPDATE documents SET pod_document_id = new_id WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'documents_attach_pod: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_documents_attach_pod ON documents;
CREATE TRIGGER trg_documents_attach_pod
  AFTER INSERT OR UPDATE OF status, signed_file_data, pod_load_id, pod_stop_order ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_attach_pod();

-- Firma por paradas: un mismo documento (p. ej. un BOL con varias entregas en la misma hoja)
-- se firma por turnos, cada receiver en su sección. Cada campo puede llevar "stop" (el stop_order
-- de la parada de la carga). Al firmar una parada, la página guarda una copia del PDF con lo
-- firmado hasta ese momento en signing/<id>/stop_<n>.pdf y agrega n a signed_stops; aquí esa copia
-- se agrega como POD/BOL de esa parada y viaja al broker con el "Completed" de la parada.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_stops integer[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION documents_attach_pod()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  s record;
  stop_id uuid;
  new_id uuid;
  n integer;
  path text;
  base text;
BEGIN
  IF NEW.pod_load_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, reference_number, tenant_id INTO l FROM loads WHERE id = NEW.pod_load_id;
  IF l.id IS NULL THEN RETURN NEW; END IF;
  base := regexp_replace(COALESCE(NEW.file_name, 'documento'), '\.pdf$', '', 'i');

  -- Documento con campos por parada: un POD por cada parada ya firmada (sin repetir)
  IF jsonb_path_exists(COALESCE(NEW.fields, '[]'::jsonb), '$[*] ? (exists(@.stop))') THEN
    FOREACH n IN ARRAY COALESCE(NEW.signed_stops, '{}') LOOP
      path := 'signing/' || NEW.id || '/stop_' || n || '.pdf';
      SELECT id, stop_type INTO s FROM load_stops WHERE load_id = l.id AND stop_order = n LIMIT 1;
      IF s.id IS NULL OR EXISTS (SELECT 1 FROM pod_documents WHERE load_id = l.id AND file_url = path) THEN
        CONTINUE;
      END IF;
      INSERT INTO pod_documents (load_id, stop_id, file_url, file_name, file_type, tenant_id)
      VALUES (l.id, s.id, path,
              CASE WHEN s.stop_type = 'pickup' THEN 'BOL #' ELSE 'POD #' END || COALESCE(l.reference_number, '')
                || ' - Parada ' || (n + 1) || ' - ' || base || '.pdf',
              'pdf', l.tenant_id);
    END LOOP;
    RETURN NEW;
  END IF;

  -- Documento de una sola firma: al quedar firmado, POD de la entrega elegida
  IF NEW.status <> 'signed' OR NEW.pod_document_id IS NOT NULL
     OR NEW.signed_file_data IS NULL OR NEW.signed_file_data LIKE 'data:%' THEN
    RETURN NEW;
  END IF;

  SELECT ls.id INTO stop_id FROM load_stops ls
  WHERE ls.load_id = l.id AND ls.stop_type = 'delivery'
    AND (NEW.pod_stop_order IS NULL OR ls.stop_order = NEW.pod_stop_order)
  ORDER BY ls.stop_order DESC LIMIT 1;

  INSERT INTO pod_documents (load_id, stop_id, file_url, file_name, file_type, tenant_id)
  VALUES (l.id, stop_id, NEW.signed_file_data,
          'POD #' || COALESCE(l.reference_number, '') || ' - ' || base || '.pdf',
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
  AFTER INSERT OR UPDATE OF status, signed_file_data, pod_load_id, pod_stop_order, signed_stops ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_attach_pod();

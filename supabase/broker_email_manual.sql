-- ═══ Emails al broker: el de fotos y BOL/POD pasa a ser manual ═══
-- Ya no sale solo al subir archivos: lo manda el driver con el botón "Pickup/Delivery
-- Completed" de la app, o el dispatcher desde el detalle de la carga.
-- El email de llegada por GPS no cambia.

DROP TRIGGER IF EXISTS pod_uploaded_broker_email ON pod_documents;
DROP FUNCTION IF EXISTS trg_pod_uploaded_broker_email();

-- La IA ya no clasifica fotos: la columna queda sin uso
ALTER TABLE pod_documents DROP COLUMN IF EXISTS is_document;

-- ═══ Fotos que son el BOL/POD ═══
-- Algunos drivers le toman foto al papel en vez de escanearlo. La IA marca cuáles fotos
-- son el documento; el resultado se guarda para no volver a analizar la misma foto.
-- null = sin analizar, true = es el BOL/POD, false = es una foto normal de la carga.

ALTER TABLE pod_documents ADD COLUMN IF NOT EXISTS is_document boolean;

-- ═══ Borrar la carga de prueba 123456789 ═══
-- Solo se borra si de verdad está vacía: sin fotos, sin documentos y sin pagos.
-- Si tiene algo, el script no la toca y lo dice.

-- ─── 1. Qué es y de quién es ───
SELECT l.id, l.reference_number, l.status, l.origin, l.destination,
       l.pickup_date, l.delivery_date, l.total_rate, l.driver_id, l.created_at,
       t.name AS tenant,
       (SELECT count(*) FROM load_stops s WHERE s.load_id = l.id) AS paradas,
       (SELECT count(*) FROM pod_documents d WHERE d.load_id = l.id) AS documentos,
       (SELECT count(*) FROM payments p WHERE p.load_id = l.id) AS pagos
FROM loads l
LEFT JOIN tenants t ON t.id = l.tenant_id
WHERE l.reference_number = '123456789';

-- ─── 2. Borrarla, con sus hijos, solo si está vacía ───
DO $$
DECLARE
  v_id uuid;
  v_docs integer;
  v_pagos integer;
BEGIN
  SELECT id INTO v_id FROM loads WHERE reference_number = '123456789';
  IF v_id IS NULL THEN
    RAISE NOTICE 'No existe ninguna carga 123456789';
    RETURN;
  END IF;

  SELECT count(*) INTO v_docs FROM pod_documents WHERE load_id = v_id;
  SELECT count(*) INTO v_pagos FROM payments WHERE load_id = v_id;
  IF v_docs > 0 OR v_pagos > 0 THEN
    RAISE NOTICE 'NO se borró: la carga tiene % documento(s) y % pago(s)', v_docs, v_pagos;
    RETURN;
  END IF;

  DELETE FROM broker_email_queue WHERE load_id = v_id;
  DELETE FROM load_email_threads WHERE load_id = v_id;
  DELETE FROM load_routes WHERE load_id = v_id;
  DELETE FROM load_stops WHERE load_id = v_id;
  DELETE FROM loads WHERE id = v_id;
  RAISE NOTICE 'Carga de prueba 123456789 borrada';
END;
$$;

-- ─── 3. Cómo quedó ───
SELECT count(*) AS quedan FROM loads WHERE reference_number = '123456789';

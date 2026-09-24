-- ═══ Unificar drivers y camiones duplicados ═══
-- Mueve TODO lo que apunta al registro duplicado (cargas, pagos, deducciones, documentos,
-- ubicaciones, etc.) al registro que se queda, y después borra el duplicado.
-- Recorre solas todas las tablas que tengan driver_id, así no se escapa ninguna.

-- ─── Función auxiliar: pasar todo de un driver a otro ───
CREATE OR REPLACE FUNCTION merge_drivers(p_viejo uuid, p_nuevo uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
  movidas bigint;
  detalle text := '';
BEGIN
  IF p_viejo = p_nuevo THEN RETURN 'Son el mismo driver'; END IF;

  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables x
      ON x.table_schema = c.table_schema AND x.table_name = c.table_name AND x.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'driver_id' AND c.table_name <> 'drivers'
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET driver_id = $1::text::%s WHERE driver_id::text = $2::text',
      t.table_name,
      (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.table_name AND column_name = 'driver_id')
    ) USING p_nuevo, p_viejo;
    GET DIAGNOSTICS movidas = ROW_COUNT;
    IF movidas > 0 THEN detalle := detalle || t.table_name || ': ' || movidas || '; '; END IF;
  END LOOP;

  DELETE FROM drivers WHERE id = p_viejo;
  RETURN COALESCE(NULLIF(detalle, ''), 'nada que mover') || ' → duplicado borrado';
END;
$$;

-- ─── 1. Angel Aldean: el registro de agosto está vacío ───
SELECT merge_drivers(
  'dbc5d72b-f050-4e3b-8727-94411ae2293b',  -- 0 cargas, se va
  '9d5eff7e-c763-4dc7-9a90-84f4c8524545'   -- 95 cargas, se queda
) AS angel_aldean;

-- ─── 2. Reinel Calzado: las 2 cargas pasan al registro de 12 ───
SELECT merge_drivers(
  'b299ffca-fa65-42a1-b6c8-a9f619465fab',  -- 2 cargas, se va
  '9dad1591-81b6-40c4-8ff4-9b5147619988'   -- 12 cargas, se queda
) AS reinel_calzado;

-- ─── 3. Jose Cruz: las 10 cargas pasan al registro de 25 ───
SELECT merge_drivers(
  'f6de899e-1bbd-43dd-8ea9-6fc817636268',  -- 10 cargas, se va (era el activo)
  '0d98f329-7fbf-400f-982e-e854a3de19c2'   -- 25 cargas, se queda
) AS jose_cruz;

-- Jose Cruz sigue trabajando, así que el registro que queda pasa a activo
-- y se le deja el correo que se está usando hoy
UPDATE drivers
SET status = 'available', email = 'jlexpresstrasnportoffice@gmail.com'
WHERE id = '0d98f329-7fbf-400f-982e-e854a3de19c2';

-- ─── 4. Unidad 203 duplicada (la de agosto, sin cargas) ───
DELETE FROM trucks
WHERE id = '3b9a2aa3-646a-4d58-95ec-472d5b3e82fc'
  AND NOT EXISTS (SELECT 1 FROM loads WHERE truck_id::text = '3b9a2aa3-646a-4d58-95ec-472d5b3e82fc');

-- ─── 5. Cómo quedó ───
SELECT name, email, status FROM drivers
WHERE lower(trim(name)) IN ('angel aldean', 'reinel calzado', 'jose cruz')
ORDER BY name;

SELECT unit_number, vin, status FROM trucks WHERE unit_number = '203';

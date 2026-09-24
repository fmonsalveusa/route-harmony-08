-- ═══ Borrar el tenant vacío "Brothers M LLC" ═══
-- Antes de borrar, recorre TODAS las tablas que tengan tenant_id y cuenta cuántas filas
-- le pertenecen. Si encuentra aunque sea una, cancela y te dice en qué tabla está.
-- El tenant con los datos reales (AG AR Transportation LLC) no se toca.

DO $$
DECLARE
  objetivo constant uuid := '3972c8b0-e592-4699-be27-9dc5fe13e48d';  -- Brothers M LLC
  t record;
  filas bigint;
  total bigint := 0;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables x
      ON x.table_schema = c.table_schema AND x.table_name = c.table_name AND x.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND c.table_name <> 'tenants'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id::text = $1', t.table_name)
      INTO filas USING objetivo::text;
    IF filas > 0 THEN
      RAISE NOTICE 'La tabla % tiene % fila(s) de este tenant', t.table_name, filas;
      total := total + filas;
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION 'No se borró nada: el tenant todavía tiene % fila(s). Revisa los avisos de arriba.', total;
  END IF;

  DELETE FROM tenants WHERE id = objetivo;
  RAISE NOTICE 'Tenant borrado correctamente.';
END $$;

-- Verificar que quedó uno solo
SELECT id, name FROM tenants ORDER BY name;

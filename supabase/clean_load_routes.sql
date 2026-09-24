-- ═══ Limpieza mensual de rutas de mapa viejas ═══
-- load_routes guarda la línea del recorrido de cada carga: unos 100 KB por carga.
-- Las de cargas terminadas hace más de 60 días no se miran nunca, y si alguien abre una
-- de esas cargas el mapa vuelve a pedir la ruta y la dibuja igual.
-- Borrar filas aquí no toca las cargas ni las millas.

-- ─── 1. Cuánto se libera hoy (no borra nada) ───
SELECT count(*) AS rutas_a_borrar,
       pg_size_pretty(COALESCE(sum(pg_column_size(r.geometry)), 0)) AS espacio
FROM load_routes r
JOIN loads l ON l.id = r.load_id
WHERE l.status IN ('delivered', 'paid', 'tonu', 'cancelled')
  AND COALESCE(l.delivery_date::date, l.pickup_date::date) < (now() AT TIME ZONE 'America/New_York')::date - 60;

-- ─── 2. Función de limpieza ───
CREATE OR REPLACE FUNCTION clean_old_load_routes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  borradas integer;
BEGIN
  DELETE FROM load_routes r
  USING loads l
  WHERE l.id = r.load_id
    AND l.status IN ('delivered', 'paid', 'tonu', 'cancelled')
    AND COALESCE(l.delivery_date::date, l.pickup_date::date) < (now() AT TIME ZONE 'America/New_York')::date - 60;
  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$$;

-- ─── 3. Correrla ahora ───
SELECT clean_old_load_routes() AS borradas_ahora;

-- ─── 4. Y dejarla agendada: el día 1 de cada mes a las 3:20 am del Este ───
SELECT cron.unschedule('clean-load-routes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clean-load-routes');
SELECT cron.schedule('clean-load-routes', '20 7 1 * *', 'SELECT clean_old_load_routes()');

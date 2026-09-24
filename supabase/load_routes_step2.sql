-- ═══ Paso 2: borrar la columna vieja de rutas en la tabla de cargas ═══
-- Correr solo después de verificar que el mapa se ve bien en el detalle de la carga,
-- en Tracking y en el historial de rutas del driver.

-- ─── 1. Verificar que no quedó ninguna ruta sin mudar ───
-- Tiene que devolver 0. Si devuelve otra cosa, NO sigas: avísame.
SELECT count(*) AS rutas_sin_mudar
FROM loads l
WHERE l.route_geometry IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM load_routes r WHERE r.load_id = l.id);

-- ─── 2. Borrar la columna ───
ALTER TABLE loads DROP COLUMN IF EXISTS route_geometry;

-- ─── 3. Compactar la tabla para recuperar el espacio ───
-- VACUUM no corre en el editor de Supabase, así que se agenda para las 3:10 am.
SELECT cron.schedule('vacuum-loads-routes', '10 7 * * *', 'VACUUM FULL loads');

-- ─── 4. Mañana: borrar la tarea y ver el tamaño nuevo ───
-- SELECT cron.unschedule('vacuum-loads-routes');
-- ANALYZE loads;
-- SELECT pg_size_pretty(pg_total_relation_size('loads')) AS tamano_nuevo;

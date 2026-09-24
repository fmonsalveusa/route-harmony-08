-- ═══ Liberar espacio: borrar la ruta del mapa de cargas viejas ═══
-- route_geometry es solo la línea dibujada en el mapa. Las millas (loads.miles,
-- loads.empty_miles) y la distancia de cada parada viven en otras columnas y no se tocan.
-- Al abrir una de estas cargas, el mapa vuelve a pedir la ruta a Mapbox y la dibuja igual.
--
-- Correr los pasos de a uno y revisar el resultado antes de seguir.

-- ─── 1. Ver cuánto espacio se libera y cuántas cargas se tocan ───
SELECT
  count(*) FILTER (WHERE route_geometry IS NOT NULL) AS cargas_con_ruta,
  pg_size_pretty(COALESCE(sum(pg_column_size(route_geometry)), 0)) AS espacio_de_esas_rutas
FROM loads
WHERE status IN ('delivered', 'paid', 'tonu', 'cancelled')
  AND COALESCE(delivery_date::date, pickup_date::date) < (now() AT TIME ZONE 'America/New_York')::date - 90
  AND COALESCE(miles, 0) > 0;

-- ─── 2. Tamaño actual de la tabla, para comparar después ───
SELECT pg_size_pretty(pg_total_relation_size('loads')) AS tamano_actual;

-- ─── 3. Borrar las rutas (no borra cargas ni millas) ───
UPDATE loads
SET route_geometry = NULL
WHERE route_geometry IS NOT NULL
  AND status IN ('delivered', 'paid', 'tonu', 'cancelled')
  AND COALESCE(delivery_date::date, pickup_date::date) < (now() AT TIME ZONE 'America/New_York')::date - 90
  AND COALESCE(miles, 0) > 0;

-- ─── 4. Devolverle el espacio al disco ───
-- VACUUM FULL bloquea la tabla unos segundos y no se puede correr dentro de una transacción.
-- Córrelo solo, en un momento sin movimiento (de noche o temprano).
VACUUM FULL loads;
ANALYZE loads;

-- ─── 5. Verificar el tamaño nuevo ───
SELECT pg_size_pretty(pg_total_relation_size('loads')) AS tamano_nuevo;

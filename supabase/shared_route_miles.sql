-- ═══ Rentabilidad: millas reales de cargas que comparten camión y días (parciales) ═══
-- Cuando dos o más cargas del mismo camión se cruzan en días, el camión hace un solo
-- recorrido. Se guarda la parte de ese recorrido (incluidas las vacías) que le toca a
-- cada carga, para el diésel y los costos por milla. NULL = la carga va sola.
ALTER TABLE loads ADD COLUMN IF NOT EXISTS shared_route_miles numeric;

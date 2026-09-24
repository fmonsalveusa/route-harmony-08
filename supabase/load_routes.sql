-- ═══ La ruta del mapa sale de la tabla de cargas ═══
-- route_geometry es la línea dibujada del recorrido: pesa cientos de KB por carga y hace
-- pesada toda la tabla, que se recorre entera cada vez que se abre la lista de cargas.
-- Se muda a su propia tabla: la lista deja de arrastrarla y el detalle la busca cuando la necesita.
--
-- Paso 1 de 2. El paso 2 (borrar la columna vieja) va en otro archivo, después de verificar.

CREATE TABLE IF NOT EXISTS load_routes (
  load_id uuid PRIMARY KEY REFERENCES loads(id) ON DELETE CASCADE,
  geometry jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE load_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_all" ON load_routes;
CREATE POLICY "tenant_all" ON load_routes FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE load_routes TO authenticated;
GRANT ALL ON TABLE load_routes TO service_role;

-- Mudar las rutas que todavía existen
INSERT INTO load_routes (load_id, geometry)
SELECT id, route_geometry
FROM loads
WHERE route_geometry IS NOT NULL
ON CONFLICT (load_id) DO NOTHING;

-- Cuántas se mudaron
SELECT count(*) AS rutas_mudadas FROM load_routes;

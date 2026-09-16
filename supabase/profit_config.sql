-- ═══ Configuración de Profit por Carga ═══

-- 1. MPG por camión (consumo estimado de diésel)
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS mpg numeric DEFAULT 7.5;

-- 2. Settings globales del tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS diesel_price_per_gallon numeric DEFAULT 3.85;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS working_days_per_month integer DEFAULT 21;

-- 3. Costos variables por milla (mantenimiento, cauchos, etc.)
CREATE TABLE IF NOT EXISTS truck_variable_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  description text NOT NULL,
  cost_per_mile numeric NOT NULL DEFAULT 0,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_truck_variable_costs_truck ON truck_variable_costs(truck_id);

ALTER TABLE truck_variable_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access" ON truck_variable_costs;
CREATE POLICY "tenant_access" ON truck_variable_costs
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

GRANT ALL ON TABLE truck_variable_costs TO authenticated, service_role;

-- 4. Vincular gastos reales a una carga (peajes, parqueo, reparaciones)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS load_id uuid REFERENCES loads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_load ON expenses(load_id);

-- 5. Valores iniciales sugeridos por camión (mantenimiento + cauchos)
INSERT INTO truck_variable_costs (truck_id, description, cost_per_mile, tenant_id)
SELECT id, 'Maintenance Reserve', 0.12, tenant_id FROM trucks WHERE status = 'active'
ON CONFLICT DO NOTHING;

INSERT INTO truck_variable_costs (truck_id, description, cost_per_mile, tenant_id)
SELECT id, 'Tires', 0.04, tenant_id FROM trucks WHERE status = 'active'
ON CONFLICT DO NOTHING;

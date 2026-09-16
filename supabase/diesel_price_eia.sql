-- ═══ Precio del diésel automático desde EIA ═══

-- 1. Historial semanal (dato público, igual para todos los tenants)
CREATE TABLE IF NOT EXISTS diesel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL,
  region text NOT NULL,              -- 'national' | 'lower_atlantic'
  price numeric NOT NULL,
  source text NOT NULL DEFAULT 'eia',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period, region)
);

ALTER TABLE diesel_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON diesel_prices;
CREATE POLICY "authenticated_read" ON diesel_prices FOR SELECT TO authenticated USING (true);
GRANT SELECT ON TABLE diesel_prices TO authenticated;
GRANT ALL ON TABLE diesel_prices TO service_role;

-- 2. Config del tenant: región, de dónde salió el precio y cuándo
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS diesel_price_region text NOT NULL DEFAULT 'lower_atlantic';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS diesel_price_source text NOT NULL DEFAULT 'manual';   -- 'eia' | 'manual'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS diesel_price_updated_at date;

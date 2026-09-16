-- ═══ Historial de configuración para el profit por carga ═══
-- Cada cambio vale desde el día en que se hizo (hora del Este) en adelante.
-- Cada carga usa los valores vigentes en su fecha de pickup.
-- Fecha de arranque: 2026-09-16 — cargas anteriores no tienen profit calculado.

-- ─── 1. Costos del camión con vigencia ─────────────────────────────────────
ALTER TABLE truck_fixed_costs ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT '2026-09-16';
ALTER TABLE truck_fixed_costs ADD COLUMN IF NOT EXISTS effective_to date;   -- exclusiva; NULL = vigente
ALTER TABLE truck_fixed_costs ALTER COLUMN effective_from SET DEFAULT ((now() AT TIME ZONE 'America/New_York')::date);

-- ─── 2. Historial de valores sueltos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS profit_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  entity_type text NOT NULL,          -- 'truck' | 'driver' | 'dispatcher' | 'tenant'
  entity_id uuid NOT NULL,
  field text NOT NULL,
  value numeric,
  value_text text,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field, effective_from)
);

ALTER TABLE profit_config_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read" ON profit_config_history;
CREATE POLICY "tenant_read" ON profit_config_history FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
GRANT SELECT ON TABLE profit_config_history TO authenticated;
GRANT ALL ON TABLE profit_config_history TO service_role;

CREATE OR REPLACE FUNCTION record_profit_config(
  p_tenant uuid, p_type text, p_id uuid, p_field text, p_value numeric, p_text text DEFAULT NULL,
  p_date date DEFAULT ((now() AT TIME ZONE 'America/New_York')::date)
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profit_config_history (tenant_id, entity_type, entity_id, field, value, value_text, effective_from)
  VALUES (p_tenant, p_type, p_id, p_field, p_value, p_text, p_date)
  ON CONFLICT (entity_type, entity_id, field, effective_from)
  DO UPDATE SET value = EXCLUDED.value, value_text = EXCLUDED.value_text, created_at = now();
END;
$$;

-- % de investor efectivo: suma de driver_investors activos; si no hay, el campo legacy del driver
CREATE OR REPLACE FUNCTION effective_investor_pct(p_driver uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM driver_investors WHERE driver_id::text = p_driver::text AND is_active)
      THEN (SELECT COALESCE(SUM(pay_percentage), 0) FROM driver_investors WHERE driver_id::text = p_driver::text AND is_active)
    ELSE (SELECT COALESCE(investor_pay_percentage, 0) FROM drivers WHERE id::text = p_driver::text)
  END;
$$;

-- ─── 3. Triggers ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_profit_history_trucks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.mpg IS DISTINCT FROM OLD.mpg THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'truck', NEW.id::uuid, 'mpg', NEW.mpg);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profit_history_trucks ON trucks;
CREATE TRIGGER profit_history_trucks AFTER INSERT OR UPDATE OF mpg ON trucks
  FOR EACH ROW EXECUTE FUNCTION trg_profit_history_trucks();

CREATE OR REPLACE FUNCTION trg_profit_history_drivers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.pay_percentage IS DISTINCT FROM OLD.pay_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'pay_percentage', NEW.pay_percentage);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.factoring_percentage IS DISTINCT FROM OLD.factoring_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'factoring_percentage', NEW.factoring_percentage);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.dispatch_service_percentage IS DISTINCT FROM OLD.dispatch_service_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'dispatch_service_percentage', NEW.dispatch_service_percentage);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.service_type IS DISTINCT FROM OLD.service_type THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'service_type', NULL, NEW.service_type);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.investor_pay_percentage IS DISTINCT FROM OLD.investor_pay_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'investor_pct', effective_investor_pct(NEW.id::uuid));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profit_history_drivers ON drivers;
CREATE TRIGGER profit_history_drivers
  AFTER INSERT OR UPDATE OF pay_percentage, factoring_percentage, dispatch_service_percentage, service_type, investor_pay_percentage
  ON drivers FOR EACH ROW EXECUTE FUNCTION trg_profit_history_drivers();

CREATE OR REPLACE FUNCTION trg_profit_history_driver_investors() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_id uuid := COALESCE(NEW.driver_id::text, OLD.driver_id::text)::uuid;
BEGIN
  PERFORM record_profit_config(
    (SELECT tenant_id::uuid FROM drivers WHERE id::text = d_id::text), 'driver', d_id, 'investor_pct', effective_investor_pct(d_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS profit_history_driver_investors ON driver_investors;
CREATE TRIGGER profit_history_driver_investors AFTER INSERT OR UPDATE OR DELETE ON driver_investors
  FOR EACH ROW EXECUTE FUNCTION trg_profit_history_driver_investors();

CREATE OR REPLACE FUNCTION trg_profit_history_dispatchers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'dispatcher', NEW.id::uuid, 'commission_percentage', NEW.commission_percentage);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.dispatch_service_percentage IS DISTINCT FROM OLD.dispatch_service_percentage THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'dispatcher', NEW.id::uuid, 'dispatch_service_percentage', NEW.dispatch_service_percentage);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profit_history_dispatchers ON dispatchers;
CREATE TRIGGER profit_history_dispatchers
  AFTER INSERT OR UPDATE OF commission_percentage, dispatch_service_percentage
  ON dispatchers FOR EACH ROW EXECUTE FUNCTION trg_profit_history_dispatchers();

CREATE OR REPLACE FUNCTION trg_profit_history_tenants() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.working_days_per_month IS DISTINCT FROM OLD.working_days_per_month THEN
    PERFORM record_profit_config(NEW.id::uuid, 'tenant', NEW.id::uuid, 'working_days_per_month', NEW.working_days_per_month);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profit_history_tenants ON tenants;
CREATE TRIGGER profit_history_tenants AFTER UPDATE OF working_days_per_month ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_profit_history_tenants();

-- ─── 4. Valores iniciales: lo configurado hoy vale desde 2026-09-16 ─────────
SELECT record_profit_config(tenant_id::uuid, 'truck', id::uuid, 'mpg', mpg, NULL, '2026-09-16') FROM trucks;

SELECT record_profit_config(tenant_id::uuid, 'driver', id::uuid, 'pay_percentage', pay_percentage, NULL, '2026-09-16') FROM drivers;
SELECT record_profit_config(tenant_id::uuid, 'driver', id::uuid, 'factoring_percentage', factoring_percentage, NULL, '2026-09-16') FROM drivers;
SELECT record_profit_config(tenant_id::uuid, 'driver', id::uuid, 'dispatch_service_percentage', dispatch_service_percentage, NULL, '2026-09-16') FROM drivers;
SELECT record_profit_config(tenant_id::uuid, 'driver', id::uuid, 'service_type', NULL, service_type, '2026-09-16') FROM drivers;
SELECT record_profit_config(tenant_id::uuid, 'driver', id::uuid, 'investor_pct', effective_investor_pct(id::uuid), NULL, '2026-09-16') FROM drivers;

SELECT record_profit_config(tenant_id::uuid, 'dispatcher', id::uuid, 'commission_percentage', commission_percentage, NULL, '2026-09-16') FROM dispatchers;
SELECT record_profit_config(tenant_id::uuid, 'dispatcher', id::uuid, 'dispatch_service_percentage', dispatch_service_percentage, NULL, '2026-09-16') FROM dispatchers;

SELECT record_profit_config(id::uuid, 'tenant', id::uuid, 'working_days_per_month', working_days_per_month, NULL, '2026-09-16') FROM tenants;

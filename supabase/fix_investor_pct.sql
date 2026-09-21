-- ═══ Corregir el % de investor usado en la Rentabilidad ═══
-- El % viejo del driver (investor_pay_percentage) solo cuenta si el driver tiene un investor con nombre,
-- igual que en la generación de pagos. Antes se tomaba siempre, y drivers sin investor mostraban 15%.

CREATE OR REPLACE FUNCTION effective_investor_pct(p_driver uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM driver_investors WHERE driver_id::text = p_driver::text AND is_active)
      THEN (SELECT COALESCE(SUM(pay_percentage), 0) FROM driver_investors WHERE driver_id::text = p_driver::text AND is_active)
    ELSE (
      SELECT CASE WHEN COALESCE(trim(investor_name), '') <> '' THEN COALESCE(investor_pay_percentage, 0) ELSE 0 END
      FROM drivers WHERE id::text = p_driver::text
    )
  END;
$$;

-- Registrar también cuando cambia el nombre del investor del driver
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
  IF TG_OP = 'INSERT'
     OR NEW.investor_pay_percentage IS DISTINCT FROM OLD.investor_pay_percentage
     OR NEW.investor_name IS DISTINCT FROM OLD.investor_name THEN
    PERFORM record_profit_config(NEW.tenant_id::uuid, 'driver', NEW.id::uuid, 'investor_pct', effective_investor_pct(NEW.id::uuid));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profit_history_drivers ON drivers;
CREATE TRIGGER profit_history_drivers
  AFTER INSERT OR UPDATE OF pay_percentage, factoring_percentage, dispatch_service_percentage, service_type, investor_pay_percentage, investor_name
  ON drivers FOR EACH ROW EXECUTE FUNCTION trg_profit_history_drivers();

-- Recalcular el % de investor ya guardado en el historial con la regla corregida
UPDATE profit_config_history h
SET value = effective_investor_pct(h.entity_id)
WHERE h.entity_type = 'driver' AND h.field = 'investor_pct';

-- Para revisar: drivers con % viejo pero sin investor (ahora cuentan como 0%)
SELECT name, investor_pay_percentage, investor_name
FROM drivers
WHERE COALESCE(investor_pay_percentage, 0) > 0
  AND COALESCE(trim(investor_name), '') = ''
  AND NOT EXISTS (SELECT 1 FROM driver_investors di WHERE di.driver_id::text = drivers.id::text AND di.is_active)
ORDER BY name;

-- ═══ Ajustes de la carga → pago generado ═══
-- Los ajustes que se ponen en "Load Adjustments" antes de que exista el pago solo se
-- copiaban al pago cuando el pago se creaba desde el navegador. Hoy los pagos los crea el
-- trigger de factoring = ready en la base de datos, y ese camino no copiaba los ajustes.
-- Este trigger los copia al crearse cualquier pago, venga de donde venga.

-- Un ajuste de carga entra una sola vez en cada pago
CREATE UNIQUE INDEX IF NOT EXISTS payment_adjustments_once_per_load_adj
  ON payment_adjustments (payment_id, load_adjustment_id)
  WHERE load_adjustment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION copy_load_adjustments_to_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.load_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO payment_adjustments
    (payment_id, adjustment_type, reason, description, amount, load_adjustment_id, tenant_id)
  SELECT NEW.id, a.adjustment_type, a.reason, a.description, a.amount, a.id, NEW.tenant_id
  FROM load_adjustments a
  WHERE a.load_id = NEW.load_id
    AND NEW.recipient_type = ANY (a.apply_to)
  ON CONFLICT (payment_id, load_adjustment_id) WHERE load_adjustment_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_load_adjustments_to_payment ON payments;
CREATE TRIGGER trg_copy_load_adjustments_to_payment
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION copy_load_adjustments_to_payment();

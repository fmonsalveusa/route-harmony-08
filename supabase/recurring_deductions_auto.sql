-- ═══ Deducciones recurrentes automáticas ═══
-- Igual que los ajustes de carga: solo se aplicaban cuando el pago se creaba desde el
-- navegador, y hoy los pagos los crea la base de datos. Este trigger las aplica al crearse
-- cualquier pago del beneficiario:
--   per_load → en cada pago
--   weekly   → en el primer pago de la semana (lunes a domingo, hora del Este)
--   monthly  → en el primer pago del mes (hora del Este)

CREATE OR REPLACE FUNCTION apply_recurring_deductions_to_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
  hoy date := (now() AT TIME ZONE 'America/New_York')::date;
  desde timestamptz;
BEGIN
  FOR d IN
    SELECT * FROM recurring_deductions
    WHERE is_active
      AND recipient_type = NEW.recipient_type
      AND recipient_id = NEW.recipient_id::text
      AND (effective_from IS NULL OR effective_from <= hoy)
  LOOP
    IF d.frequency IN ('weekly', 'monthly') THEN
      desde := (date_trunc(CASE WHEN d.frequency = 'weekly' THEN 'week' ELSE 'month' END, hoy::timestamp))
               AT TIME ZONE 'America/New_York';
      -- Ya se descontó en este período
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM payment_adjustments
        WHERE recurring_deduction_id = d.id AND created_at >= desde
      );
    END IF;

    INSERT INTO payment_adjustments
      (payment_id, adjustment_type, reason, description, amount, recurring_deduction_id, tenant_id)
    VALUES
      (NEW.id, 'deduction', d.reason, d.description, d.amount, d.id, NEW.tenant_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_recurring_deductions ON payments;
CREATE TRIGGER trg_apply_recurring_deductions
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION apply_recurring_deductions_to_payment();

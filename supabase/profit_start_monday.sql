-- ═══ Mover el inicio del cálculo de profit al lunes 2026-09-14 ═══
-- La configuración inicial (sembrada el 2026-09-16) pasa a valer desde el lunes,
-- para que las cargas del lunes y martes también tengan costos.

UPDATE truck_fixed_costs
SET effective_from = '2026-09-14'
WHERE effective_from = '2026-09-16';

-- Si ya existe un valor del 14 para el mismo campo, se conserva ese y se descarta el del 16
DELETE FROM profit_config_history h
WHERE h.effective_from = '2026-09-16'
  AND EXISTS (
    SELECT 1 FROM profit_config_history x
    WHERE x.entity_type = h.entity_type AND x.entity_id = h.entity_id
      AND x.field = h.field AND x.effective_from = '2026-09-14'
  );

UPDATE profit_config_history
SET effective_from = '2026-09-14'
WHERE effective_from = '2026-09-16';

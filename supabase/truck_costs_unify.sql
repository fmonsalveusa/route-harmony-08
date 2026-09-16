-- ═══ Unificar costos del camión en truck_fixed_costs ═══
-- Los costos por milla pasan a truck_fixed_costs con frequency = 'per_mile'.
-- Frecuencias válidas: weekly, monthly, yearly, per_mile

INSERT INTO truck_fixed_costs (truck_id, description, amount, frequency, tenant_id)
SELECT vc.truck_id, vc.description, vc.cost_per_mile, 'per_mile', vc.tenant_id
FROM truck_variable_costs vc
WHERE NOT EXISTS (
  SELECT 1 FROM truck_fixed_costs fc
  WHERE fc.truck_id = vc.truck_id
    AND fc.description = vc.description
    AND fc.frequency = 'per_mile'
);

GRANT ALL ON TABLE truck_fixed_costs TO authenticated, service_role;

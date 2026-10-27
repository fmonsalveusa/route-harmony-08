-- Origen de millas vacías puesto a mano en el detalle de la carga: el cálculo automático
-- (última entrega del driver) no lo vuelve a reemplazar al abrir la carga.
ALTER TABLE loads ADD COLUMN IF NOT EXISTS empty_miles_manual boolean NOT NULL DEFAULT false;

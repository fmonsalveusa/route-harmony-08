-- ═══ Limpieza de VINs ═══

-- 1. Unidad 223: tiene la letra O donde va un cero.
--    Los VIN no usan I, O ni Q justamente para evitar esta confusión, y el dígito
--    verificador del VIN solo cuadra con el cero.
UPDATE trucks SET vin = '3ALACWFC0KDKX8945'
WHERE upper(trim(vin)) = '3ALACWFCOKDKX8945';

-- 2. Seis unidades quedaron con el texto de ejemplo en vez del VIN real.
--    Se dejan vacías para que se vea que faltan y se puedan cargar bien.
UPDATE trucks SET vin = NULL
WHERE upper(trim(vin)) = 'VIN_CORRECTO_AQUI';

-- 3. Los VIN van siempre en mayúscula y sin espacios
UPDATE trucks SET vin = upper(trim(vin))
WHERE vin IS NOT NULL AND vin <> upper(trim(vin));

-- 4. Cómo quedó
SELECT unit_number, vin, length(vin) AS largo
FROM trucks
WHERE vin IS NULL OR length(vin) <> 17 OR vin ~ '[IOQ]'
ORDER BY unit_number;

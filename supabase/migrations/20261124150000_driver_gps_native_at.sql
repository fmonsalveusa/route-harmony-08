-- Última vez que llegó una ubicación ENVIADA POR EL PLUGIN NATIVO (gps-ping, app en segundo plano o cerrada).
-- Sirve para saber si el GPS en segundo plano funciona en el teléfono de cada driver.
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS gps_native_at timestamptz;

-- ═══ Ubicación del camión desde el ELD (respaldo del GPS de la app) ═══
-- Cada 2 minutos. Solo escribe si la app del driver no mandó GPS en los últimos 10 minutos.
SELECT cron.unschedule('eld-location') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eld-location');
SELECT cron.schedule('eld-location', '*/2 * * * *',
  (SELECT replace(replace(command, '/functions/v1/whatsapp-jobs', '/functions/v1/eld-location'), '"job":"daily"', '"job":"location"')
   FROM cron.job WHERE jobname = 'whatsapp-daily'));

-- La app del driver no siempre manda "source": si llega una ubicación con precisión (accuracy)
-- sobre una fila que venía del ELD, es GPS de la app.
CREATE OR REPLACE FUNCTION driver_location_source_fix() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.source IS NOT DISTINCT FROM OLD.source AND OLD.source = 'eld' AND NEW.accuracy IS NOT NULL THEN
    NEW.source := 'gps';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_driver_location_source_fix ON driver_locations;
CREATE TRIGGER trg_driver_location_source_fix BEFORE UPDATE ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION driver_location_source_fix();

-- Detention: hora de salida de cada parada + datos del reclamo al broker
ALTER TABLE public.load_stops ADD COLUMN IF NOT EXISTS departed_at timestamptz;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS detention_rate numeric;           -- $/hora (null = 40)
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS detention_claimed_at timestamptz;  -- reclamo enviado al broker
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS detention_claim_note text;         -- a quién / monto enviado

CREATE INDEX IF NOT EXISTS load_stops_open_arrival_idx
  ON public.load_stops (load_id) WHERE arrived_at IS NOT NULL AND departed_at IS NULL;

-- Salida automática por GPS: cuando el camión ya marcó llegada y se aleja más de 800 m
-- de la parada, se guarda la hora de salida (si el driver no la marcó antes al completar).
CREATE OR REPLACE FUNCTION public.auto_mark_stop_departure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.accuracy, 0) > 200 THEN
    RETURN NEW;
  END IF;

  UPDATE load_stops st
     SET departed_at = now()
    FROM loads l
   WHERE st.load_id = l.id
     AND l.driver_id = NEW.driver_id::text
     AND st.arrived_at IS NOT NULL
     AND st.departed_at IS NULL
     AND st.arrived_at > now() - interval '36 hours'
     AND st.arrived_at < now() - interval '5 minutes'
     AND st.lat IS NOT NULL AND st.lng IS NOT NULL
     AND 6371000 * 2 * asin(sqrt(
       power(sin(radians(st.lat - NEW.lat) / 2), 2) +
       cos(radians(NEW.lat)) * cos(radians(st.lat)) * power(sin(radians(st.lng - NEW.lng) / 2), 2)
     )) > 800;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_stop_departure: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_location_auto_departure ON public.driver_locations;
CREATE TRIGGER driver_location_auto_departure
  AFTER INSERT OR UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.auto_mark_stop_departure();

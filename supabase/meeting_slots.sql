-- ═══ Reuniones de la landing: un solo cliente por fecha y hora ═══

-- 1. Horas ya reservadas en una fecha (solo la hora, sin datos personales).
--    La landing la consulta sin iniciar sesión.
CREATE OR REPLACE FUNCTION get_booked_meeting_slots(p_date date)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT meeting_time
  FROM meeting_requests
  WHERE meeting_date = p_date
    AND COALESCE(status, '') <> 'cancelled';
$$;

GRANT EXECUTE ON FUNCTION get_booked_meeting_slots(date) TO anon, authenticated;

-- 2. Candado: no puede haber dos reuniones activas en la misma fecha y hora.
--    Si ya existen reuniones duplicadas, no se crea y se muestran para que canceles una de cada par.
DO $$
DECLARE
  dup record;
  has_dups boolean := false;
BEGIN
  FOR dup IN
    SELECT meeting_date, meeting_time, count(*) AS n, string_agg(driver_name || ' (' || phone || ')', ', ') AS clientes
    FROM meeting_requests
    WHERE COALESCE(status, '') <> 'cancelled'
    GROUP BY meeting_date, meeting_time
    HAVING count(*) > 1
  LOOP
    has_dups := true;
    RAISE NOTICE 'Duplicado % % (% reuniones): %', dup.meeting_date, dup.meeting_time, dup.n, dup.clientes;
  END LOOP;

  IF has_dups THEN
    RAISE NOTICE 'No se creó el candado: cancela las reuniones duplicadas y vuelve a correr este SQL.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_slot_active
      ON meeting_requests (meeting_date, meeting_time)
      WHERE COALESCE(status, '') <> 'cancelled';
    RAISE NOTICE 'Candado creado.';
  END IF;
END $$;

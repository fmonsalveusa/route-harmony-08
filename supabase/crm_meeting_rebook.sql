-- ═══ CRM: una reunión nueva regresa el contacto a "Reunión agendada" ═══
-- crm_upsert_contact solo avanza etapas; si alguien en "Reunión hecha" agenda otra reunión,
-- vuelve a "Reunión agendada" para que se vea en el tablero.
CREATE OR REPLACE FUNCTION public.crm_from_meeting_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  BEGIN
    v_id := crm_upsert_contact(NULL, NEW.driver_name, NEW.phone, 'web', 'meeting_scheduled',
      p_email => NEW.email,
      p_city => concat_ws(', ', NEW.city, NEW.state), p_vehicle => NEW.truck_type, p_service => NEW.service_interest,
      p_note => 'Reunión agendada para el ' || to_char(NEW.meeting_date, 'MM/DD/YYYY') || ' a las ' || NEW.meeting_time
        || coalesce(E'\nComentarios: ' || nullif(NEW.comments, ''), ''),
      p_created_at => NEW.created_at);
    UPDATE crm_contacts SET stage = 'meeting_scheduled', updated_at = now()
    WHERE id = v_id AND stage IN ('new', 'meeting_done', 'lost');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_from_meeting_request: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

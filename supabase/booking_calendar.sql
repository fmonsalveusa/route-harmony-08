-- ═══ Agenda tipo Calendly (página /agendar) ═══
-- Disponibilidad configurable desde el CRM, horas ocupadas de Google Calendar (dirección secreta iCal,
-- secreto GCAL_ICS_URL), invitación .ics por email al prospecto y a tu calendario, recordatorios por
-- email 24 h y 1 h antes, y enlace para reagendar o cancelar. El aviso al grupo de WhatsApp de
-- reuniones sigue igual (whatsapp-jobs).

ALTER TABLE meeting_requests
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS duration_min int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS invite_sequence int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_reminder_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_reminder_1h_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS meeting_requests_manage_token_uq ON meeting_requests(manage_token);

-- Las reservas entran solo por la función booking (service role): ya no se insertan directo sin sesión
DROP POLICY IF EXISTS "Anyone can insert meeting_requests" ON meeting_requests;
-- Staff puede marcar/cancelar reuniones desde el CRM
DROP POLICY IF EXISTS "Staff can update meeting_requests" ON meeting_requests;
CREATE POLICY "Staff can update meeting_requests" ON meeting_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dispatcher') OR has_role(auth.uid(), 'accounting'));

CREATE TABLE IF NOT EXISTS booking_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  weekdays int[] NOT NULL DEFAULT '{1,2,3,4,5}',      -- 0 = domingo … 6 = sábado
  day_start time NOT NULL DEFAULT '16:30',            -- hora del Este
  day_end time NOT NULL DEFAULT '18:30',
  duration_min int NOT NULL DEFAULT 30,
  buffer_min int NOT NULL DEFAULT 0,
  min_notice_hours int NOT NULL DEFAULT 2,
  max_days_ahead int NOT NULL DEFAULT 30,
  calendar_email text,                                -- tu Google Calendar: recibe la invitación de cada reunión
  meeting_title text NOT NULL DEFAULT 'Reunión con 58 Dispatch Service',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read booking_settings" ON booking_settings;
CREATE POLICY "Staff read booking_settings" ON booking_settings FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin write booking_settings" ON booking_settings;
CREATE POLICY "Admin write booking_settings" ON booking_settings FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin')) OR is_master_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin')) OR is_master_admin(auth.uid()));
GRANT ALL ON TABLE booking_settings TO authenticated, service_role;

-- Fila por defecto para el tenant que recibe las reuniones (el que tiene grupo de reuniones)
INSERT INTO booking_settings (tenant_id)
SELECT id FROM tenants WHERE whatsapp_meetings_group_id IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- El contacto del CRM también guarda el email que deja el prospecto
CREATE OR REPLACE FUNCTION public.crm_from_meeting_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM crm_upsert_contact(NULL, NEW.driver_name, NEW.phone, 'web', 'meeting_scheduled',
      p_email => NEW.email,
      p_city => concat_ws(', ', NEW.city, NEW.state), p_vehicle => NEW.truck_type, p_service => NEW.service_interest,
      p_note => 'Reunión agendada para el ' || to_char(NEW.meeting_date, 'MM/DD/YYYY') || ' a las ' || NEW.meeting_time
        || coalesce(E'\nComentarios: ' || nullif(NEW.comments, ''), ''),
      p_created_at => NEW.created_at);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_from_meeting_request: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';

-- Evento de Google Calendar creado por el script de Google (GCAL_SCRIPT_URL): para moverlo o borrarlo
ALTER TABLE meeting_requests ADD COLUMN IF NOT EXISTS gcal_event_id text;

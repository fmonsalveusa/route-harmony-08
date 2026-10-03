-- ═══ CRM: personas que contactan, reuniones, notas y seguimiento ═══
-- Los contactos se crean solos desde WhatsApp (whatsapp_leads), la web (meeting_requests)
-- y el onboarding (Edge Function driver-onboarding). Se identifican por los últimos 10 dígitos del teléfono.
-- Etapas: new → contacted → meeting_scheduled → meeting_done → onboarding → client | lost

CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text,
  phone_key text GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) STORED,
  email text,
  city text,
  vehicle text,
  service text,
  source text NOT NULL DEFAULT 'manual',       -- whatsapp | web | onboarding | manual
  stage text NOT NULL DEFAULT 'new',
  next_action text,
  next_action_at timestamptz,
  reminder_sent_at timestamptz,
  driver_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_stage_check CHECK (stage IN ('new','contacted','meeting_scheduled','meeting_done','onboarding','client','lost'))
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant_stage ON crm_contacts (tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone_key ON crm_contacts (tenant_id, phone_key);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_action ON crm_contacts (next_action_at) WHERE reminder_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',            -- note | meeting | call | stage | system
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact ON crm_notes (contact_id, created_at DESC);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_all" ON crm_contacts;
CREATE POLICY "tenant_all" ON crm_contacts FOR ALL
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
DROP POLICY IF EXISTS "tenant_all" ON crm_notes;
CREATE POLICY "tenant_all" ON crm_notes FOR ALL
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
GRANT ALL ON TABLE crm_contacts TO authenticated, service_role;
GRANT ALL ON TABLE crm_notes TO authenticated, service_role;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_crm_reminders boolean NOT NULL DEFAULT true;

-- ─── Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crm_stage_rank(s text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'meeting_scheduled' THEN 3
    WHEN 'meeting_done' THEN 4 WHEN 'onboarding' THEN 5 WHEN 'client' THEN 6 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION crm_stage_label(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'new' THEN 'Nuevo' WHEN 'contacted' THEN 'Contactado' WHEN 'meeting_scheduled' THEN 'Reunión agendada'
    WHEN 'meeting_done' THEN 'Reunión hecha' WHEN 'onboarding' THEN 'En onboarding' WHEN 'client' THEN 'Cliente registrado'
    WHEN 'lost' THEN 'Perdido' ELSE s END
$$;

-- Tenant de los contactos que llegan sin tenant (WhatsApp y web): el que tiene los grupos configurados
CREATE OR REPLACE FUNCTION crm_default_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM tenants
  ORDER BY (whatsapp_meetings_group_id IS NULL), (whatsapp_admin_group_id IS NULL), created_at
  LIMIT 1
$$;

-- Crea o actualiza el contacto por teléfono. Solo avanza de etapa (nunca retrocede);
-- un contacto "Perdido" se reabre si vuelve a agendar o se registra.
CREATE OR REPLACE FUNCTION crm_upsert_contact(
  p_tenant uuid, p_name text, p_phone text, p_source text, p_stage text,
  p_email text DEFAULT NULL, p_city text DEFAULT NULL, p_vehicle text DEFAULT NULL,
  p_service text DEFAULT NULL, p_note text DEFAULT NULL, p_driver_id uuid DEFAULT NULL,
  p_created_at timestamptz DEFAULT now()
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_contact crm_contacts%ROWTYPE;
BEGIN
  IF p_tenant IS NULL THEN p_tenant := crm_default_tenant(); END IF;
  IF p_tenant IS NULL THEN RETURN NULL; END IF;

  IF length(v_key) = 10 THEN
    SELECT * INTO v_contact FROM crm_contacts WHERE tenant_id = p_tenant AND phone_key = v_key
    ORDER BY created_at LIMIT 1;
  END IF;

  IF v_contact.id IS NULL THEN
    INSERT INTO crm_contacts (tenant_id, name, phone, email, city, vehicle, service, source, stage, driver_id, created_at, updated_at)
    VALUES (p_tenant, coalesce(nullif(trim(p_name), ''), p_phone, ''), p_phone, p_email, p_city, p_vehicle, p_service,
            p_source, p_stage, p_driver_id, p_created_at, p_created_at)
    RETURNING * INTO v_contact;
  ELSE
    UPDATE crm_contacts SET
      name = CASE WHEN coalesce(name, '') = '' OR name = phone THEN coalesce(nullif(trim(p_name), ''), name) ELSE name END,
      email = coalesce(email, p_email),
      city = coalesce(city, p_city),
      vehicle = coalesce(vehicle, nullif(p_vehicle, '')),
      service = coalesce(service, nullif(p_service, '')),
      driver_id = coalesce(p_driver_id, driver_id),
      stage = CASE
        WHEN stage = 'lost' AND p_stage IN ('meeting_scheduled', 'onboarding', 'client') THEN p_stage
        WHEN stage <> 'lost' AND crm_stage_rank(p_stage) > crm_stage_rank(stage) THEN p_stage
        ELSE stage END
    WHERE id = v_contact.id
    RETURNING * INTO v_contact;
  END IF;

  IF p_note IS NOT NULL AND p_note <> '' THEN
    INSERT INTO crm_notes (tenant_id, contact_id, kind, body, created_at)
    VALUES (p_tenant, v_contact.id, 'system', p_note, p_created_at);
  END IF;
  RETURN v_contact.id;
END $$;
REVOKE ALL ON FUNCTION crm_upsert_contact FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crm_upsert_contact TO service_role;

-- ─── Triggers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crm_contacts_before_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.next_action_at IS DISTINCT FROM OLD.next_action_at THEN NEW.reminder_sent_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_contacts_before_update ON crm_contacts;
CREATE TRIGGER trg_crm_contacts_before_update BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION crm_contacts_before_update();

-- Cada cambio de etapa queda en el historial del contacto
CREATE OR REPLACE FUNCTION crm_log_stage_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO crm_notes (tenant_id, contact_id, kind, body, created_by)
    VALUES (NEW.tenant_id, NEW.id, 'stage', crm_stage_label(OLD.stage) || ' → ' || crm_stage_label(NEW.stage), auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_log_stage_change ON crm_contacts;
CREATE TRIGGER trg_crm_log_stage_change AFTER UPDATE OF stage ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION crm_log_stage_change();

-- WhatsApp entrante → contacto nuevo (o completa vehículo/servicio)
CREATE OR REPLACE FUNCTION crm_from_whatsapp_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM crm_upsert_contact(NULL, NEW.name, NEW.phone, 'whatsapp', 'new',
      p_vehicle => NEW.vehicle, p_service => NEW.service,
      p_note => CASE WHEN TG_OP = 'INSERT' THEN 'Escribió por WhatsApp' END);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_from_whatsapp_lead: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_from_whatsapp_lead ON whatsapp_leads;
CREATE TRIGGER trg_crm_from_whatsapp_lead AFTER INSERT OR UPDATE OF name, vehicle, service ON whatsapp_leads
  FOR EACH ROW EXECUTE FUNCTION crm_from_whatsapp_lead();

-- Reunión agendada desde la web → etapa "Reunión agendada"
CREATE OR REPLACE FUNCTION crm_from_meeting_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM crm_upsert_contact(NULL, NEW.driver_name, NEW.phone, 'web', 'meeting_scheduled',
      p_city => concat_ws(', ', NEW.city, NEW.state), p_vehicle => NEW.truck_type, p_service => NEW.service_interest,
      p_note => 'Reunión agendada para el ' || to_char(NEW.meeting_date, 'MM/DD/YYYY') || ' a las ' || NEW.meeting_time
        || coalesce(E'\nComentarios: ' || nullif(NEW.comments, ''), ''),
      p_created_at => NEW.created_at);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_from_meeting_request: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_from_meeting_request ON meeting_requests;
CREATE TRIGGER trg_crm_from_meeting_request AFTER INSERT ON meeting_requests
  FOR EACH ROW EXECUTE FUNCTION crm_from_meeting_request();

-- ─── Carga inicial con lo que ya existe ─────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM crm_contacts) THEN RETURN; END IF;
  FOR r IN
    SELECT created_at, 'lead' AS t, name, phone, vehicle, service, NULL::text AS city, NULL::date AS d, NULL::text AS tm, NULL::text AS comments
      FROM whatsapp_leads
    UNION ALL
    SELECT created_at, 'meeting', driver_name, phone, truck_type, service_interest, concat_ws(', ', city, state), meeting_date, meeting_time, comments
      FROM meeting_requests WHERE status <> 'cancelled'
    ORDER BY 1
  LOOP
    IF r.t = 'lead' THEN
      PERFORM crm_upsert_contact(NULL, r.name, r.phone, 'whatsapp', 'new', p_vehicle => r.vehicle, p_service => r.service,
        p_note => 'Escribió por WhatsApp', p_created_at => r.created_at);
    ELSE
      PERFORM crm_upsert_contact(NULL, r.name, r.phone, 'web', 'meeting_scheduled', p_city => r.city, p_vehicle => r.vehicle,
        p_service => r.service,
        p_note => 'Reunión agendada para el ' || to_char(r.d, 'MM/DD/YYYY') || ' a las ' || r.tm || coalesce(E'\nComentarios: ' || nullif(r.comments, ''), ''),
        p_created_at => r.created_at);
    END IF;
  END LOOP;

  -- Los que ya son drivers quedan como clientes
  UPDATE crm_contacts c SET stage = 'client', driver_id = d.id
  FROM drivers d
  WHERE length(c.phone_key) = 10 AND right(regexp_replace(coalesce(d.phone, ''), '\D', '', 'g'), 10) = c.phone_key;
END $$;

-- ─── Recordatorios de seguimiento por WhatsApp (cada 15 minutos) ────────────
SELECT cron.unschedule('whatsapp-crm-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-crm-reminders');
SELECT cron.schedule('whatsapp-crm-reminders', '*/15 * * * *',
  (SELECT replace(command, '"job":"daily"', '"job":"crm_reminders"') FROM cron.job WHERE jobname = 'whatsapp-daily'));

-- ─── Requisitos del contacto ────────────────────────────────────────────────
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS has_medical_card boolean NOT NULL DEFAULT false;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS has_active_mc boolean NOT NULL DEFAULT false;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS has_eld boolean NOT NULL DEFAULT false;

-- ─── Reunión: checklist de pasos y grupo de WhatsApp del contacto ───────────
-- meeting = { "checks": { "referido": true, ... }, "sent": { "service_info": "2026-10-03T..." } }
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS meeting jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS whatsapp_group_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_crm_meeting boolean NOT NULL DEFAULT true;

-- ─── Se quitan las etapas manuales "Contactado" y "En onboarding" ───────────
UPDATE crm_contacts SET stage = 'new' WHERE stage = 'contacted';
UPDATE crm_contacts SET stage = 'meeting_done' WHERE stage = 'onboarding';
ALTER TABLE crm_contacts DROP CONSTRAINT crm_contacts_stage_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_stage_check CHECK (stage IN ('new','meeting_scheduled','meeting_done','client','lost'));

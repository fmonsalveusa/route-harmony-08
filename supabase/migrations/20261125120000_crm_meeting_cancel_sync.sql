-- CRM al día cuando una reunión se cancela o se reagenda (desde el CRM o desde el enlace del prospecto):
--  • Cancelada: nota en el historial del contacto y, si no le queda otra reunión pendiente, vuelve a "Nuevo".
--  • Reagendada: nota con la fecha nueva.
ALTER TABLE public.meeting_requests ADD COLUMN IF NOT EXISTS cancel_source text;

CREATE OR REPLACE FUNCTION public.crm_sync_meeting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text := right(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), 10);
  v_contact record;
  v_when text := to_char(NEW.meeting_date, 'MM/DD/YYYY') || ' a las ' || NEW.meeting_time;
  v_old_when text := to_char(OLD.meeting_date, 'MM/DD/YYYY') || ' a las ' || OLD.meeting_time;
  v_pending int;
BEGIN
  IF length(v_key) <> 10 THEN RETURN NEW; END IF;
  BEGIN
    FOR v_contact IN SELECT id, tenant_id, stage FROM crm_contacts WHERE phone_key = v_key LOOP
      IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
        INSERT INTO crm_notes (tenant_id, contact_id, kind, body)
        VALUES (v_contact.tenant_id, v_contact.id, 'system',
          CASE WHEN NEW.cancel_source = 'crm'
            THEN 'Reunión del ' || v_old_when || ' cancelada desde el CRM'
            ELSE 'El prospecto canceló la reunión del ' || v_old_when || ' desde su enlace' END);
        SELECT count(*) INTO v_pending FROM meeting_requests m
          WHERE m.id <> NEW.id AND m.status <> 'cancelled'
            AND m.meeting_date >= (now() AT TIME ZONE 'America/New_York')::date
            AND right(regexp_replace(coalesce(m.phone, ''), '\D', '', 'g'), 10) = v_key;
        IF v_pending = 0 THEN
          UPDATE crm_contacts SET stage = 'new', updated_at = now()
            WHERE id = v_contact.id AND stage = 'meeting_scheduled';
        END IF;
      ELSIF NEW.status IS DISTINCT FROM 'cancelled'
        AND (NEW.meeting_date IS DISTINCT FROM OLD.meeting_date OR NEW.meeting_time IS DISTINCT FROM OLD.meeting_time) THEN
        INSERT INTO crm_notes (tenant_id, contact_id, kind, body)
        VALUES (v_contact.tenant_id, v_contact.id, 'system',
          'Reunión reagendada: del ' || v_old_when || ' al ' || v_when);
        UPDATE crm_contacts SET stage = 'meeting_scheduled', updated_at = now()
          WHERE id = v_contact.id AND stage IN ('new', 'meeting_done');
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_sync_meeting_change: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_crm_sync_meeting_change ON public.meeting_requests;
CREATE TRIGGER trg_crm_sync_meeting_change
  AFTER UPDATE OF status, meeting_date, meeting_time ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_meeting_change();

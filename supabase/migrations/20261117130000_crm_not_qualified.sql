-- CRM: etapa "No calificado" con motivo (sale del tablero, se puede reactivar)
alter table public.crm_contacts drop constraint if exists crm_contacts_stage_check;
alter table public.crm_contacts add constraint crm_contacts_stage_check
  check (stage = any (array['new','meeting_scheduled','meeting_done','client','not_qualified']));
alter table public.crm_contacts
  add column if not exists lost_reason text,
  add column if not exists lost_note text,
  add column if not exists lost_at timestamptz,
  add column if not exists lost_from_stage text;

create or replace function public.crm_stage_label(s text) returns text language sql immutable as $$
  SELECT CASE s WHEN 'new' THEN 'Nuevo' WHEN 'contacted' THEN 'Contactado' WHEN 'meeting_scheduled' THEN 'Reunión agendada'
    WHEN 'meeting_done' THEN 'Reunión hecha' WHEN 'onboarding' THEN 'En onboarding' WHEN 'client' THEN 'Cliente registrado'
    WHEN 'lost' THEN 'Perdido' WHEN 'not_qualified' THEN 'No calificado' ELSE s END
$$;

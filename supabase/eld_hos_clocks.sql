-- ═══ Relojes de horas de servicio (HOS) de los company drivers, desde HOS247 y RouteOne ═══
-- La función eld-hos los guarda cada hora. Minutos restantes; null = sin dato.

CREATE TABLE IF NOT EXISTS driver_hos_clocks (
  driver_id uuid PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL,                    -- HOS247 | RouteOne
  duty_status text,                        -- driving | on_duty | off_duty | sleeper | personal_conveyance | yard_move
  status_since timestamptz,                -- desde cuándo está en ese estado
  until_break_min int,
  driving_min int,
  shift_min int,
  cycle_min int,
  cycle_limit_min int,                     -- 4200 (70 h) o 3600 (60 h)
  computed boolean NOT NULL DEFAULT false, -- true = calculado por nosotros a partir de los eventos (RouteOne)
  eld_name text,                           -- nombre del driver en el ELD
  reported_at timestamptz,                 -- último dato del ELD
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_hos_clocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read" ON driver_hos_clocks;
CREATE POLICY "staff_read" ON driver_hos_clocks FOR SELECT
  USING (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role) OR has_role(auth.uid(), 'dispatcher'::app_role))));
GRANT SELECT ON TABLE driver_hos_clocks TO authenticated;
GRANT ALL ON TABLE driver_hos_clocks TO service_role;

-- Cada hora, al minuto 5
SELECT cron.unschedule('eld-hos') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eld-hos');
SELECT cron.schedule('eld-hos', '5 * * * *',
  (SELECT replace(replace(command, '/functions/v1/whatsapp-jobs', '/functions/v1/eld-hos'), '"job":"daily"', '"job":"hos"')
   FROM cron.job WHERE jobname = 'whatsapp-daily'));

-- ═══ Rate confirmations recibidos por email → borradores de carga ═══
-- La función rc-inbox revisa cada 5 minutos el Gmail de las empresas activas,
-- lee el PDF con la IA y deja un borrador. El borrador no es una carga: no cuenta en
-- reportes ni pagos hasta que alguien lo convierte desde Loads.

CREATE TABLE IF NOT EXISTS rc_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id text NOT NULL,                  -- Message-ID del email (no se procesa dos veces)
  account text NOT NULL,                     -- cuenta de Gmail donde llegó
  thread_id text,                            -- hilo de Gmail: se enlaza solo a la carga
  subject text,
  from_email text,
  received_at timestamptz,
  pdf_path text,                             -- driver-documents/<pdf_path>
  pdf_name text,
  extracted jsonb,                           -- lo que leyó la IA (mismo formato que extract-pdf)
  reference_number text,
  broker text,
  origin text,
  destination text,
  pickup_date text,
  total_rate numeric,
  -- pending (por revisar) | converted | discarded | existing_load (ya había carga) | not_rc | error
  status text NOT NULL DEFAULT 'pending',
  load_id uuid REFERENCES loads(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_rc_inbox_status ON rc_inbox (tenant_id, status, created_at DESC);

ALTER TABLE rc_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all" ON rc_inbox;
CREATE POLICY "staff_all" ON rc_inbox FOR ALL
  USING (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role) OR has_role(auth.uid(), 'dispatcher'::app_role))))
  WITH CHECK (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role) OR has_role(auth.uid(), 'dispatcher'::app_role))));
GRANT ALL ON TABLE rc_inbox TO authenticated, service_role;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rc_inbox_enabled boolean NOT NULL DEFAULT true;

-- Cada 5 minutos (mismo secreto que los demás crons)
SELECT cron.unschedule('rc-inbox') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rc-inbox');
SELECT cron.schedule('rc-inbox', '*/5 * * * *',
  (SELECT replace(replace(command, '/functions/v1/whatsapp-jobs', '/functions/v1/rc-inbox'), '"job":"daily"', '"job":"scan"')
   FROM cron.job WHERE jobname = 'whatsapp-daily'));

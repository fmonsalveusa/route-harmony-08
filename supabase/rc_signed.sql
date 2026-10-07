-- ═══ Rate confirmation firmado y devuelto al broker ═══
-- La firma vive en el bucket privado company-private (solo el service role la lee).
-- Cada carga tiene a lo sumo un RC firmado: draft (para revisar) → sent.

CREATE TABLE IF NOT EXISTS load_rc_signed (
  load_id uuid PRIMARY KEY REFERENCES loads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',          -- draft | sent | failed
  file_path text,                                 -- driver-documents/<file_path>
  source_path text,                               -- RC original usado
  placement jsonb,                                -- dónde se escribió cada dato (para revisar)
  driver_name text,
  driver_phone text,
  truck_number text,
  error text,
  sent_to text,
  prepared_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE load_rc_signed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read" ON load_rc_signed;
CREATE POLICY "staff_read" ON load_rc_signed FOR SELECT
  USING (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role) OR has_role(auth.uid(), 'dispatcher'::app_role))));
GRANT SELECT ON TABLE load_rc_signed TO authenticated;
GRANT ALL ON TABLE load_rc_signed TO service_role;

-- Quién firma los RC
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rc_signer_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rc_signer_title text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_rc_signed boolean NOT NULL DEFAULT true;
UPDATE tenants SET rc_signer_name = coalesce(rc_signer_name, 'Francisco Monsalve'), rc_signer_title = coalesce(rc_signer_title, 'Owner');

-- Bucket privado para la firma (sin políticas: solo el service role)
INSERT INTO storage.buckets (id, name, public) VALUES ('company-private', 'company-private', false) ON CONFLICT (id) DO NOTHING;

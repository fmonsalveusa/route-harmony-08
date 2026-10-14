-- Datos fiscales para los 1099 (SSN o EIN, nombre legal y si es persona o compañía).
-- Solo admin y accounting pueden ver o editar: el SSN es dato sensible.
CREATE TABLE IF NOT EXISTS payee_tax_info (
  recipient_type text NOT NULL CHECK (recipient_type IN ('driver', 'investor', 'dispatcher')),
  recipient_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual', 'business')),
  legal_name text,              -- nombre de la persona o de la compañía tal como va en el 1099
  tax_id text,                  -- SSN (individual) o EIN (business), solo dígitos
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_type, recipient_id)
);

ALTER TABLE payee_tax_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_admin_accounting" ON payee_tax_info;
CREATE POLICY "tax_admin_accounting" ON payee_tax_info FOR ALL TO authenticated
  USING (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role))))
  WITH CHECK (is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounting'::app_role))));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payee_tax_info TO authenticated;
GRANT ALL ON TABLE payee_tax_info TO service_role;

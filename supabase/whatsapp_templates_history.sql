-- ═══ WhatsApp: textos editables, historial e interruptores de todos los avisos ═══

-- 1. Interruptores que faltaban (antes siempre activos)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_load_assigned boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_load_delivered boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_maintenance_alerts boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_payment_receipts boolean NOT NULL DEFAULT true;

-- 2. Textos editados. Si no hay fila para un aviso, se usa el texto original del sistema.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_key text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_all" ON whatsapp_templates;
CREATE POLICY "tenant_all" ON whatsapp_templates FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
GRANT ALL ON TABLE whatsapp_templates TO authenticated, service_role;

-- 3. Historial de mensajes
CREATE TABLE IF NOT EXISTS whatsapp_message_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  template_key text NOT NULL,
  recipient_type text,          -- driver | investor | dispatcher | admin
  recipient_name text,
  group_id text,
  message text,
  status text NOT NULL,         -- sent | failed | skipped
  error text,
  reference text,               -- carga, unidad, documento, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_history_tenant_created ON whatsapp_message_history (tenant_id, created_at DESC);

ALTER TABLE whatsapp_message_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read" ON whatsapp_message_history;
CREATE POLICY "tenant_read" ON whatsapp_message_history FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
GRANT SELECT ON TABLE whatsapp_message_history TO authenticated;
GRANT ALL ON TABLE whatsapp_message_history TO service_role;

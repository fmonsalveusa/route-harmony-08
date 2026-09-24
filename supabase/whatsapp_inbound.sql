-- ═══ Asistente de WhatsApp para quien escribe al número de la empresa ═══
-- Guarda cada persona que escribe, lo que se le respondió y en qué quedó.
-- Solo aplica a chats 1 a 1 de números que no están en el TMS.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_inbound_assistant boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS whatsapp_leads (
  phone text PRIMARY KEY,
  name text,
  vehicle text,
  service text,
  handoff boolean NOT NULL DEFAULT false,   -- true = lo sigue una persona, el asistente se calla
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  replies_today int NOT NULL DEFAULT 0,
  last_reply_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_leads_updated ON whatsapp_leads (updated_at DESC);

ALTER TABLE whatsapp_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read" ON whatsapp_leads;
CREATE POLICY "tenant_read" ON whatsapp_leads FOR SELECT
  USING (auth.uid() IS NOT NULL);
GRANT SELECT ON TABLE whatsapp_leads TO authenticated;
GRANT ALL ON TABLE whatsapp_leads TO service_role;

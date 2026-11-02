-- ═══ Asistente de WhatsApp entrante: memoria, mensajes repetidos y base de conocimiento ═══

-- 1) Memoria por contacto: resumen de lo que ya se sabe de la persona (lo actualiza la IA)
ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- 2) Mensajes ya procesados: Whapi puede mandar el mismo mensaje más de una vez
CREATE TABLE IF NOT EXISTS whatsapp_inbound_seen (
  message_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_seen_created ON whatsapp_inbound_seen (created_at);
ALTER TABLE whatsapp_inbound_seen ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE whatsapp_inbound_seen TO service_role;

-- 3) Base de conocimiento: preguntas frecuentes con su respuesta fija (editable desde el TMS).
--    La IA solo elige cuál corresponde; el texto que se envía es exactamente el guardado.
CREATE TABLE IF NOT EXISTS whatsapp_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  question text NOT NULL,        -- de qué trata / cómo suelen preguntarlo
  answer text NOT NULL,          -- respuesta en español
  answer_en text,                -- respuesta en inglés (opcional)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_knowledge_tenant ON whatsapp_knowledge (tenant_id);

ALTER TABLE whatsapp_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_all" ON whatsapp_knowledge;
CREATE POLICY "tenant_all" ON whatsapp_knowledge FOR ALL
  USING (tenant_id = (SELECT get_user_tenant_id(auth.uid())) OR (SELECT is_master_admin(auth.uid())))
  WITH CHECK (tenant_id = (SELECT get_user_tenant_id(auth.uid())) OR (SELECT is_master_admin(auth.uid())));
GRANT ALL ON TABLE whatsapp_knowledge TO authenticated, service_role;

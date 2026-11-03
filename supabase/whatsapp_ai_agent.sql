-- ═══ Agente de IA de WhatsApp (número propio, (980) 457-6720) ═══
-- Conversa con quien escribe por primera vez, le pide sus datos y le agenda la reunión.
-- Usa la misma tabla whatsapp_leads (memoria por contacto), las preguntas frecuentes y meeting_requests.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_ai_agent boolean NOT NULL DEFAULT true;

ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;  -- datos que va juntando el agente
ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS source text;                                  -- 'agent' = escribió al número del agente
ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS meeting_booked_at timestamptz;

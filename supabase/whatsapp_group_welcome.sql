-- ═══ Bienvenida automática al crear un grupo de WhatsApp ═══
-- Interruptor de la automatización (encendida por defecto).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_group_welcome boolean NOT NULL DEFAULT true;

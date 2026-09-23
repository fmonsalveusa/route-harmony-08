
-- Interruptor del aviso de onboarding al grupo de administracion
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_onboarding boolean NOT NULL DEFAULT true;

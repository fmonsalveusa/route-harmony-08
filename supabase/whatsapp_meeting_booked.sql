
-- Interruptor del aviso de reunion agendada
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_meeting_booked boolean NOT NULL DEFAULT true;

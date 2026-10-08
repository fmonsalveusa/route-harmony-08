-- Aviso diario por WhatsApp a drivers sin GPS en segundo plano
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_gps_reminders boolean NOT NULL DEFAULT true;

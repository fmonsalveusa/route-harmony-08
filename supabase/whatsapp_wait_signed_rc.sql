-- ═══ "Crear y firmar RC": el WhatsApp de carga asignada sale después de enviar el RC al broker ═══
-- La carga se crea con whatsapp_wait_rc = true; load-whatsapp-notify la salta mientras tanto
-- y broker-email la libera (y manda el aviso) al enviar el RC o al cerrar la ventana de revisión.
ALTER TABLE loads ADD COLUMN IF NOT EXISTS whatsapp_wait_rc boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';

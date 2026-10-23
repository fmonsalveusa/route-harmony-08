-- ═══ Link público de Google Play en los mensajes guardados ═══
-- Los mensajes que se editaron a mano en la pestaña Avisos pueden tener pegado el link
-- de prueba interna. Aquí se cambia por el de la tienda pública.
UPDATE whatsapp_templates
SET body = replace(body,
  'https://play.google.com/apps/internaltest/4700846304603948197',
  'https://play.google.com/store/apps/details?id=com.dispatchup.app')
WHERE body LIKE '%play.google.com/apps/internaltest%';

-- Cómo quedó
SELECT template_key, left(body, 200) AS mensaje
FROM whatsapp_templates
WHERE body LIKE '%play.google.com%';

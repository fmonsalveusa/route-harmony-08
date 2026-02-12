

# Agente de IA para la Landing Page (reemplazando el boton de WhatsApp)

## Resumen

Se eliminara el boton flotante de WhatsApp y se reemplazara por un widget de chat con IA en la esquina inferior derecha. El agente respondera en espanol sobre los servicios de Load Up y guiara a los visitantes. El enlace de WhatsApp seguira disponible en el navbar, hero y footer.

## Cambios

### 1. Crear Edge Function: `supabase/functions/landing-chat/index.ts`
- Endpoint publico (sin JWT) que recibe mensajes del visitante
- System prompt detallado con informacion de los 7 servicios de Load Up, contacto WhatsApp, y tono profesional en espanol
- Usa Lovable AI Gateway con modelo `google/gemini-3-flash-preview`
- Streaming SSE para respuestas en tiempo real

### 2. Crear componente: `src/components/landing/AIChatWidget.tsx`
- Boton flotante en esquina inferior derecha (posicion actual del WhatsApp)
- Ventana de chat con:
  - Header "Asistente Load Up"
  - Mensajes con scroll
  - Botones de opciones rapidas: "Dispatching", "Leasing", "Curso", "Permisos", "Otro"
  - Input de texto libre
  - Indicador de escritura durante streaming
- Responsive en movil

### 3. Actualizar: `src/pages/Landing.tsx`
- Eliminar `<WhatsAppButton />`
- Agregar `<AIChatWidget />`

### 4. Actualizar: `supabase/config.toml`
- Agregar `[functions.landing-chat]` con `verify_jwt = false`

### 5. Archivo `src/components/landing/WhatsAppButton.tsx`
- Se deja sin usar (no se elimina el archivo, solo se quita de Landing.tsx)

## System Prompt del agente

Incluira:
- Los 7 servicios: Dispatching MC propio, Leasing bajo MC de Load Up, Curso de Dispatcher, Tracking Up App, Asesoria Personal, Tramite de Permisos, Load Up TMS
- WhatsApp: +1 (980) 766-8815
- Instrucciones para guiar al registro o contacto por WhatsApp
- No inventar precios ni datos no proporcionados

## Detalles tecnicos

- Modelo: `google/gemini-3-flash-preview`
- Sin dependencias nuevas
- Sin persistencia de conversaciones (efimeras)
- Manejo de errores 429/402 con mensajes amigables


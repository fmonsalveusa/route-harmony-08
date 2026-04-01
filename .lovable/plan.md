

## Actualizar el chatbot de la landing a "Dispatch Up"

### Problema
El archivo `supabase/functions/landing-chat/index.ts` todavía usa "Load Up" en el prompt del sistema del chatbot AI. Es el único lugar donde queda el nombre viejo en el código. Los componentes de la landing ya dicen "Dispatch Up" correctamente.

Si en el preview ves "Load Up" en la landing misma, es un tema de caché del navegador — un hard refresh (Ctrl+Shift+R) lo resuelve.

### Cambio

**`supabase/functions/landing-chat/index.ts`**
- Reemplazar todas las menciones de "Load Up" por "Dispatch Up" en el `SYSTEM_PROMPT` (líneas 9, 15, 25, 32):
  - "Asistente Virtual de **Dispatch Up**"
  - "Opera bajo el MC# de **Dispatch Up**"
  - "**Dispatch Up** TMS"
  - "Responde SOLO sobre los servicios de **Dispatch Up**"

Esto es un cambio backend (edge function) que se despliega automáticamente.




# Plan: Driver Onboarding via Link Publico

## Resumen

Crear un flujo de onboarding donde un admin genera un link unico para cada nuevo driver. El driver abre ese link (sin necesidad de login) y completa un formulario multi-paso con su informacion personal y la de su camion. Al enviar, los datos se guardan automaticamente en las tablas `drivers` y `trucks` existentes.

## Como Funciona

1. **El admin** va a la pagina de Drivers y hace clic en "Generar Link de Onboarding"
2. Se crea un token unico en una nueva tabla `onboarding_tokens` con el `tenant_id` y opcionalmente un dispatcher pre-asignado
3. El admin copia el link (ej: `https://tu-app.lovable.app/onboarding/abc123`) y lo envia al driver
4. **El driver** abre el link, ve un formulario publico (sin login) con 3 pasos:
   - **Paso 1**: Informacion personal (nombre, email, telefono, licencia, fechas de expiracion, documentos del driver)
   - **Paso 2**: Informacion del camion (unit number, tipo, make, model, year, VIN, dimensiones, documentos del camion)
   - **Paso 3**: Revision y envio
5. Al enviar, una Edge Function valida el token, crea el driver y el truck en la base de datos con el `tenant_id` correcto, y marca el token como usado

## Cambios Tecnicos

### 1. Nueva tabla: `onboarding_tokens`
- `id` (uuid, PK)
- `tenant_id` (uuid, requerido)
- `token` (text, unico, generado con crypto)
- `dispatcher_id` (text, opcional - pre-asignar dispatcher)
- `status` (text: 'pending' | 'completed' | 'expired')
- `driver_name` (text, opcional - nombre provisional)
- `created_at`, `expires_at` (timestamps)
- `completed_at` (timestamp, nullable)
- RLS: lectura publica para tokens validos, escritura solo para tenant users

### 2. Nueva Edge Function: `driver-onboarding`
- Recibe: token + datos del driver + datos del truck + archivos
- Valida que el token exista, no este expirado ni usado
- Inserta el driver en `drivers` con el `tenant_id` del token
- Inserta el truck en `trucks` con el `tenant_id` del token
- Vincula driver con truck
- Sube documentos al bucket `driver-documents`
- Marca el token como `completed`
- Usa `service_role` key para bypasear RLS

### 3. Nueva pagina: `/onboarding/:token`
- Ruta publica (sin ProtectedRoute)
- Formulario multi-paso reutilizando los mismos campos de `DriverFormDialog` y `TruckFormDialog`
- Solo muestra los campos que el driver debe llenar (sin status, dispatcher, porcentajes de pago)
- Incluye upload de documentos (licencia, medical card, W9, fotos del camion)
- UI limpia con branding de la empresa

### 4. Dialogo para generar tokens (en pagina Drivers)
- Boton "Generate Onboarding Link" junto al boton "New Driver"
- Formulario simple: nombre del driver (opcional), dispatcher pre-asignado (opcional)
- Genera el token via Supabase insert
- Muestra el link copiable

### 5. Actualizacion de rutas en App.tsx
- Agregar ruta publica `/onboarding/:token` fuera de ProtectedRoute




## Pre-llenar datos del formulario de la Landing en el Onboarding

### Problema
Cuando un driver llena el formulario en la landing page (nombre, email, telefono, tipo de vehiculo) y hace clic en "Comenzar Registro", se abre la pagina de onboarding pero solo aparece el nombre pre-llenado. El email, telefono y tipo de vehiculo se pierden porque no se guardan en la base de datos.

### Causa raiz
- La Edge Function `create-onboarding-token` recibe los 4 campos (name, email, phone, truck_type) pero solo guarda `driver_name` en la tabla `onboarding_tokens`
- La tabla `onboarding_tokens` no tiene columnas para email, phone ni truck_type
- La pagina de onboarding solo pre-llena el nombre desde `data.driver_name`

### Solucion

**1. Agregar columnas a la tabla `onboarding_tokens`**
- `driver_email` (text, nullable)
- `driver_phone` (text, nullable)
- `truck_type` (text, nullable)

**2. Actualizar la Edge Function `create-onboarding-token`**
- Guardar `email`, `phone` y `truck_type` en las nuevas columnas al crear el token

**3. Actualizar `src/pages/DriverOnboarding.tsx`**
- Al cargar el token, pre-llenar tambien email, phone en el formulario de driver
- Pre-llenar truck_type en el formulario de truck

### Resultado
Al hacer clic en "Comenzar Registro" desde la landing, todos los campos previamente llenados (nombre, email, telefono, tipo de vehiculo) apareceran ya completados en el formulario de onboarding.


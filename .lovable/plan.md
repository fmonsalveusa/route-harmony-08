

## Agendar Reunion - Seccion Landing Page con Notificacion por Email

### Objetivo
Agregar una nueva seccion en la landing page que permita a los visitantes agendar una reunion con la empresa, con un formulario completo y envio de email de notificacion al correo de la empresa.

### Campos del Formulario
- **Nombre Completo del Driver** (texto, requerido)
- **Numero de Telefono** (telefono, requerido)
- **Ciudad** (texto, requerido)
- **Estado** (dropdown con las 51 siglas de estados de EE.UU. desde `usStates.ts`)
- **Tipo de Vehiculo** (dropdown: Box Truck, Hotshot, Dry Van, Flatbed, Reefer)
- **Fecha** (calendario con selector de fecha usando el componente Calendar existente)
- **Hora** (dropdown con intervalos de 30 minutos: 8:00 AM, 8:30 AM, ... 6:00 PM)

### Cambios Planificados

**1. Nueva tabla en la base de datos: `meeting_requests`**
Almacena cada solicitud de reunion para tener un registro persistente.
- Columnas: `id`, `driver_name`, `phone`, `city`, `state`, `truck_type`, `meeting_date`, `meeting_time`, `status` (pending/confirmed/completed), `created_at`
- RLS: permitir INSERT publico (sin autenticacion, ya que es la landing page publica), SELECT solo para usuarios autenticados del tenant

**2. Nueva Edge Function: `send-meeting-request`**
- Recibe los datos del formulario
- Inserta el registro en `meeting_requests`
- Envia un email de notificacion a `agartransportation1@gmail.com` (usando las credenciales GMAIL existentes) con todos los detalles de la reunion solicitada
- No requiere autenticacion (formulario publico)
- Usa la misma libreria `denomailer` que ya se usa en `send-invoice-email`

**3. Nuevo componente: `src/components/landing/MeetingSection.tsx`**
- Diseno visual consistente con la seccion OnboardingSection existente (fondo oscuro, formulario en card con animacion)
- Icono de calendario y titulo "Agenda una Reunion"
- Lado izquierdo: texto de beneficios y descripcion
- Lado derecho: formulario con los campos solicitados
- Validacion de campos requeridos antes de enviar
- Feedback con toast de exito/error

**4. Modificar: `src/pages/Landing.tsx`**
- Importar y agregar `MeetingSection` entre VehicleGallery y OnboardingSection

### Detalles Tecnicos

- **Selector de Fecha**: usa el componente `Calendar` con `Popover` existente, formato MM/DD/YYYY
- **Selector de Hora**: genera intervalos de 30 minutos desde 8:00 AM hasta 6:00 PM (21 opciones)
- **Estados**: reutiliza la lista `US_STATES` de `src/lib/usStates.ts`
- **Email**: HTML formateado con tabla de detalles de la reunion, enviado via Gmail SMTP con los secrets `GMAIL_USER` y `GMAIL_APP_PASSWORD` ya configurados
- **Sin nuevas dependencias**: todo se logra con componentes y librerias existentes


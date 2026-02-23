

# Agregar Nombre del Driver en Todas las Notificaciones

## Problema
Algunas notificaciones no incluyen el nombre del driver en el titulo o mensaje, lo que dificulta identificar rapidamente a quien se refiere la alerta.

## Cambios

### 1. `src/components/LoadFormDialog.tsx` - Load Assigned
**Antes:**
- Titulo: "Nueva carga asignada"  
- Mensaje: "Se te asigno la carga #REF de ORIGIN a DESTINATION"

**Despues:**
- Titulo: "Load Assigned - DRIVER_NAME"
- Mensaje: "DRIVER_NAME | #REF | ORIGIN -> DESTINATION"

### 2. `src/pages/driver-app/DriverLoadDetail.tsx` - Start Route / Status Change
**Antes:**
- Titulo: "Status: In Transit"
- Mensaje: "PROFILE changed load REF to In Transit"

**Despues:**
- Titulo: "In Transit - DRIVER_NAME"
- Mensaje: "DRIVER_NAME | Load #REF | ORIGIN -> DESTINATION"

Se usara `driver?.name` (del record de driver ya cargado en el state) en lugar de `profile?.full_name` para consistencia.

### 3. `src/components/driver-app/StopCard.tsx` - Arrived / Picked Up / Delivered / POD
Estas notificaciones ya incluyen `driverName` en el mensaje, pero el titulo no lo muestra. Se actualizaran los titulos:

**Arrived** - Titulo: "Arrived - DRIVER_NAME" (antes: "Driver arrived at pickup")
**Picked Up** - Titulo: "Picked Up - DRIVER_NAME" (antes: "Picked Up")  
**Delivered** - Titulo: "Delivered - DRIVER_NAME" (antes: "Load Delivered!")
**POD uploaded** - Titulo: "POD Uploaded - DRIVER_NAME" (antes: "POD uploaded")

### 4. `src/components/driver-app/DocumentScanner.tsx` - Scanner BOL/POD
**Antes:** Titulo: "BOL escaneado"
**Despues:** Titulo: "BOL Scanned - DRIVER_NAME"

### 5. `src/components/NotificationBell.tsx` - Mejora visual
- Reemplazar emojis por iconos Lucide (MapPin, Camera, Truck, Package, UserPlus, Wrench) con colores por tipo
- Cambiar `truncate` a `line-clamp-3` para que el mensaje con el nombre del driver sea visible completo

### 6. `src/components/LiveNotificationToasts.tsx` - Toasts flotantes
- Agregar tipo `load_assigned` al mapa de iconos (icono Package, color violeta)
- Cambiar `line-clamp-2` a `line-clamp-3` para mostrar toda la info

## Resumen de archivos a modificar
1. `src/components/LoadFormDialog.tsx`
2. `src/pages/driver-app/DriverLoadDetail.tsx`
3. `src/components/driver-app/StopCard.tsx`
4. `src/components/driver-app/DocumentScanner.tsx`
5. `src/components/NotificationBell.tsx`
6. `src/components/LiveNotificationToasts.tsx`


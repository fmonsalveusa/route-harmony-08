
# Funcionalidades Avanzadas para la App del Driver

## Resumen

Agregar al plan de la PWA del conductor las siguientes funciones clave: navegacion con Google Maps desde cada direccion, estatus "Arrived" por parada, carga de fotos/escaneo de PODs, cambio de estatus a Delivered, notificaciones en tiempo real en la app web, y vista de pagos por carga.

---

## 1. Link "Ir a Mapa" en cada direccion

Cada direccion (pickup y delivery) en el detalle de carga del driver tendra un boton/link que abre Google Maps en modo navegacion directamente en su telefono.

- Se genera un URL con formato `https://www.google.com/maps/dir/?api=1&destination={address}`
- En celulares Android abre la app de Google Maps automaticamente; en iPhone abre el navegador y ofrece abrir Maps
- Se muestra como un icono de navegacion al lado de cada direccion

**Nota:** Este link tambien se agregara en el `LoadDetailPanel.tsx` de la app web para que cualquier usuario pueda usarlo.

---

## 2. Estatus "Arrived" por parada

### Base de datos
- Agregar columna `arrived_at` (TIMESTAMPTZ, nullable) a la tabla `load_stops`
- Cuando el driver presiona "Arrived" en una parada, se guarda la fecha/hora actual

### Interfaz del driver
- Cada parada muestra un boton "Arrived" si aun no tiene `arrived_at`
- Al presionarlo, se registra el timestamp y el boton cambia a un badge verde con la hora de llegada
- Las paradas se muestran en orden cronologico con indicadores visuales (pendiente, arrived, completado)

### Reflejo en la app web
- El `LoadDetailPanel` mostrara el timestamp de llegada junto a cada parada
- El estatus de cada parada sera visible en tiempo real

---

## 3. Carga de fotos y escaneo de PODs por parada

### Interfaz del driver
- En cada parada, despues de marcar "Arrived", aparece un boton "Subir Foto / Escanear POD"
- Usa `<input type="file" accept="image/*" capture="environment">` para abrir la camara directamente
- Tambien permite seleccionar fotos de la galeria o archivos PDF
- Las fotos se suben al bucket `driver-documents` en la ruta `pods/{load_id}/`
- Se registran en la tabla `pod_documents` con el `stop_id` correspondiente

### Escaneo de paginas
- El driver puede tomar multiples fotos (una por pagina del POD)
- Cada foto se sube como documento independiente asociado a la parada
- Se muestra una galeria de miniaturas de los documentos subidos

---

## 4. Cambio de estatus a "Delivered"

### Flujo del driver
- Cuando el driver marca "Arrived" en la ultima parada de delivery y sube al menos un POD, se habilita el boton "Mark as Delivered"
- Al presionarlo, el estatus de la carga cambia de `in_transit` a `delivered` en la tabla `loads`
- Se muestra una confirmacion visual

### Flujo completo de estatus desde la app del driver
```text
dispatched --> [Driver presiona "Start Route"] --> in_transit
in_transit --> [Arrived a cada parada + sube fotos] --> ...
in_transit --> [Ultima delivery + POD subido + "Mark Delivered"] --> delivered
```

---

## 5. Notificaciones en la app web

### Base de datos
- Nueva tabla `notifications`:

```text
notifications
  - id (UUID, PK)
  - tenant_id (UUID)
  - type (TEXT) -- 'driver_arrived', 'pod_uploaded', 'status_changed'
  - title (TEXT)
  - message (TEXT)
  - load_id (UUID, nullable)
  - driver_id (TEXT, nullable)
  - is_read (BOOLEAN, default false)
  - created_at (TIMESTAMPTZ)
```

- Habilitar Realtime en la tabla `notifications`
- Politicas RLS: lectura para usuarios del mismo tenant

### Generacion de notificaciones
- Se crean automaticamente cuando el driver:
  - Marca "Arrived" en una parada
  - Sube un POD/foto
  - Cambia el estatus de la carga (Start Route, Delivered)
- Se insertan desde el frontend del driver al momento de la accion

### Interfaz web (app de dispatchers/admin)
- Icono de campana en el header/navbar con badge de conteo de no leidas
- Panel desplegable con lista de notificaciones recientes
- Al hacer clic en una notificacion, navega a la carga correspondiente
- Suscripcion Realtime para recibir nuevas notificaciones sin refrescar

---

## 6. Vista de pagos por carga

### Interfaz del driver
- Seccion "Mis Pagos" en el detalle de cada carga
- Consulta la tabla `payments` filtrando por `load_id` y `recipient_id` (el driver)
- Muestra:
  - Monto del pago
  - Porcentaje aplicado
  - Estatus: badge verde "Paid" o badge amarillo "Pending"
  - Fecha de pago (si aplica)
- Tambien una vista general "Todos mis Pagos" con totales pendientes vs pagados

---

## Plan tecnico de archivos

| Archivo | Accion |
|---|---|
| Migracion SQL | Agregar `arrived_at` a `load_stops`, crear tabla `notifications` con RLS y Realtime |
| `src/pages/driver-app/DriverLoads.tsx` | Lista de cargas con detalle, botones de estatus, link a Google Maps |
| `src/pages/driver-app/DriverLoadDetail.tsx` | Detalle completo: paradas con Arrived, fotos, PODs, pagos, Google Maps |
| `src/pages/driver-app/DriverPayments.tsx` | Vista de pagos del driver (pendientes vs pagados) |
| `src/components/driver-app/StopCard.tsx` | Componente de parada con Arrived, fotos, Google Maps link |
| `src/components/driver-app/DriverMobileLayout.tsx` | Layout movil con tab bar inferior |
| `src/components/NotificationBell.tsx` | Icono de campana con badge y panel de notificaciones para la app web |
| `src/hooks/useNotifications.ts` | Hook para leer/marcar notificaciones con suscripcion Realtime |
| `src/hooks/useDriverPayments.ts` | Hook para consultar pagos del driver autenticado |
| `src/components/LoadDetailPanel.tsx` | Agregar link "Ir a Mapa" en cada direccion y mostrar `arrived_at` |
| `src/components/AppLayout.tsx` | Agregar campana de notificaciones en el header |
| `src/App.tsx` | Agregar rutas `/driver/*` con layout movil |
| `vite.config.ts` | Agregar plugin PWA |
| `index.html` | Meta tags moviles y manifest |
| `src/pages/Install.tsx` | Pagina de instrucciones para instalar la PWA |

### Flujo visual del driver en la app

```text
Login --> Dashboard (cargas activas)
  --> Tap en carga --> Detalle con paradas
    --> Cada parada:
        [Ir a Mapa] --> Google Maps con navegacion
        [Arrived] --> Registra hora de llegada
        [Subir Foto] --> Camara/galeria --> Sube POD
    --> Ultima delivery completada:
        [Mark Delivered] --> Cambia status
        --> Notificacion enviada al dispatcher
  --> Tab "Pagos" --> Lista de pagos (Paid/Pending)
```

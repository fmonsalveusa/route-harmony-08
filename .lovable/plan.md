

# Notificaciones Bidireccionales: Web a Driver

## Situacion actual

Las notificaciones ya funcionan en una direccion: cuando el driver toma acciones (Arrived, Upload POD, Start Route, Delivered), la app web recibe la notificacion en tiempo real a traves de la campana.

Sin embargo, **falta la direccion contraria**: cuando el dispatcher/admin crea o asigna una carga, el driver no recibe ninguna notificacion.

## Que se va a agregar

### 1. Notificacion al asignar una carga a un driver

Cuando un dispatcher crea o edita una carga y le asigna un driver, se generara automaticamente una notificacion visible en la app movil del driver.

Escenarios cubiertos:
- Crear una carga nueva con driver asignado
- Editar una carga existente y cambiarle el driver

### 2. Campana de notificaciones en la app movil del driver

Actualmente la app del driver no tiene campana de notificaciones. Se agregara:
- Icono de campana en el header del layout movil
- Badge con conteo de no leidas
- Panel con lista de notificaciones recientes
- Al tocar una notificacion de carga asignada, navega al detalle de esa carga

### 3. Tipo de notificacion nuevo

Se usara el tipo `load_assigned` para estas notificaciones, con un mensaje como:
"Se te asigno la carga #REF-123 de Miami, FL a Atlanta, GA"

## Tecnico: Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/LoadFormDialog.tsx` | Agregar llamada a `createNotification` cuando se crea/edita una carga con driver asignado |
| `src/components/driver-app/DriverMobileLayout.tsx` | Agregar campana de notificaciones en el header del layout movil |
| `src/components/NotificationBell.tsx` | Agregar icono para el tipo `load_assigned` |
| `src/pages/driver-app/DriverDashboard.tsx` | Agregar seccion de notificaciones recientes (opcional) |

### Flujo completo

```text
Dispatcher crea carga + asigna driver
  --> Se inserta notificacion tipo "load_assigned"
  --> Realtime la envia al driver
  --> Campana en app movil muestra badge
  --> Driver toca notificacion --> ve detalle de la carga
  --> Driver toma acciones (Arrived, POD, Delivered)
  --> Notificaciones llegan a la app web del dispatcher
```


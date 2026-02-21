

## Plan: Redisenar la pagina de Tracking con el estilo de Tracking UP

### Que cambia

Se va a redisenar la pagina de GPS Tracking en la app movil para que tenga el mismo look y funcionalidad visual que tu app [Tracking UP](/projects/b245c5ca-fb60-40b4-9128-15101906c515), incluyendo:

- **Switch toggle** en lugar de un boton grande para activar/desactivar el rastreo
- **Tarjeta de estado** con icono animado y descripcion del estado actual
- **Alertas de permisos** que avisen si la ubicacion esta denegada o pendiente de autorizar
- **Tarjeta de ubicacion actual** con cuadricula de latitud/longitud, velocimetro y precision GPS
- **Barra de estado fija** en la parte inferior que muestre si esta conectado o desconectado

Se mantiene toda la logica actual (Wake Lock, localStorage, geofencing, auto-resume) ya que es mas robusta que la de Tracking UP.

### Detalles tecnicos

**Archivo 1: `src/contexts/DriverTrackingContext.tsx`**
- Ampliar la interfaz `DriverTrackingContextType` para exponer `speed`, `accuracy` y `permissionStatus`
- Agregar estado `permissionStatus` (`prompt` | `granted` | `denied` | `unknown`) usando `navigator.permissions.query`
- Exponer `speed` y `accuracy` junto con `lastPosition` (actualmente se envian al servidor pero no se exponen al UI)

**Archivo 2: `src/pages/driver-app/DriverTracking.tsx`**
- Reescribir la UI completa siguiendo el patron de Tracking UP:
  - Card de "Estado de Rastreo" con Switch toggle + icono + texto descriptivo
  - Card de alerta si `permissionStatus === 'denied'` (fondo rojo, icono de advertencia)
  - Card de alerta si `permissionStatus === 'prompt'` (fondo amarillo, pedir permiso)
  - Card de "Ubicacion Actual" (solo visible cuando tracking esta activo y hay coordenadas):
    - Grid 2 columnas: Latitud / Longitud
    - Velocimetro con icono
    - Indicador de precision GPS con colores (verde < 10m, amarillo < 50m, rojo > 50m)
  - Barra inferior fija con estado de conexion (verde = transmitiendo, gris = desconectado)

### Resultado esperado
La pagina de tracking se vera y se sentira igual que la app Tracking UP pero manteniendo toda la logica avanzada de persistencia, Wake Lock y geofencing que ya tiene este proyecto.

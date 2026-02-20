

# Indicador de GPS Tracking Activo en la App Web

## Problema actual
Aunque los conductores con tracking activo aparecen como marcadores en el mapa, no hay un indicador visual claro en el panel de **Drivers Available** ni en la página de **Drivers** que muestre si un conductor tiene el GPS encendido desde la app movil.

## Solucion propuesta

### 1. Indicador en el panel "Drivers Available" (Tracking page)
- Agregar un badge pulsante verde junto al nombre del conductor cuando su `updated_at` en `driver_locations` sea menor a 5 minutos.
- Mostrar texto "GPS ON" con icono de Navigation, similar al indicador que ya tiene la app movil.
- Si el tracking esta inactivo (sin registro o `updated_at` mayor a 5 min), no mostrar nada.

### 2. Indicador en la lista de conductores con cargas activas (mapa)
- En el popup del marcador del conductor, ya existe "GPS Live". Se mantiene igual.

### 3. Indicador en la pagina de Drivers (tabla principal)
- Agregar un pequeno icono de GPS junto al nombre del conductor en la tabla de Drivers cuando tenga tracking activo.
- Utilizar los mismos datos de `driver_locations` que ya se obtienen via realtime en la pagina de Tracking.

## Detalles tecnicos

### Logica de "tracking activo"
Se considera que un conductor tiene tracking activo si:
- Existe un registro en `driver_locations` para su `driver_id`
- El campo `updated_at` es menor a 5 minutos respecto a `now()`

### Cambios en archivos

**`src/pages/Tracking.tsx`**
- En el panel lateral "Drivers Available" (linea ~637), agregar junto al nombre del conductor un badge condicional:
  - Buscar el `driver_id` en el array `driverLocations` (ya disponible en el componente)
  - Si `updated_at` es reciente (< 5 min), mostrar un badge verde pulsante con icono Navigation y texto "GPS"
  - Reutilizar el mismo estilo del indicador de la app movil (`bg-success/15 text-success animate-pulse`)

**`src/pages/Drivers.tsx`**
- Agregar un fetch ligero a `driver_locations` para obtener los IDs de conductores con tracking activo
- En la tabla, junto al nombre del conductor, mostrar un pequeno icono verde de Navigation si esta activo
- Suscribirse a realtime en `driver_locations` para actualizaciones en vivo

### Resultado visual esperado

En el panel de Drivers Available:
```text
[icono usuario] Juan Perez  [GPS pulsante verde]  555-1234
```

En la tabla de Drivers:
```text
Juan Perez [icono GPS verde]
```

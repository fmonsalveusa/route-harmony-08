## Geofencing Automatico - Deteccion de llegada a paradas

### Resumen

Cuando el tracking GPS esta activo, el sistema comparara automaticamente la posicion del driver con las direcciones de las paradas de su carga activa. Al estar dentro de un radio de ~300 metros de una parada, se mostrara una alerta al driver preguntando si desea marcar su llegada, y se enviara una notificacion a la app web.

### Como funciona

1. **El driver activa el GPS tracking** (como ya funciona actualmente)
2. **El sistema obtiene las paradas de la carga activa** del driver (las que tengan coordenadas lat/lng)
3. **Cada vez que llega una posicion GPS nueva**, se calcula la distancia a cada parada pendiente (sin `arrived_at`)
4. **Si la distancia es menor a ~100 metros**, se muestra un toast/alerta al driver: "Parece que llegaste a [direccion]. Marcar llegada?"
5. **Al confirmar**, se ejecuta la misma logica que el boton "Arrived" actual (actualizar `arrived_at` + crear notificacion para la web)
6. **Cada parada solo genera una alerta una vez** por sesion para no ser repetitivo

### Detalles tecnicos

**Archivo: `src/contexts/DriverTrackingContext.tsx**`

- Agregar estado para almacenar las paradas activas del driver (`activeStops`)
- Buscar la carga activa del driver (status: `dispatched`, `in_transit`, `on_site_pickup`, `picked_up`, `on_site_delivery`) y sus `load_stops` con coordenadas
- Agregar funcion `haversineDistance(lat1, lng1, lat2, lng2)` para calcular distancia en metros entre dos coordenadas
- En cada actualizacion de posicion GPS, comparar contra las paradas pendientes
- Mantener un `Set<string>` de stop IDs ya alertados para no repetir
- Cuando se detecta proximidad (<300m), emitir un evento via el contexto (`nearbyStop`)
- Exponer `nearbyStop` y `confirmArrival(stopId)` / `dismissArrival()` en el contexto

**Archivo: `src/components/driver-app/DriverMobileLayout.tsx**`

- Consumir `nearbyStop` del contexto de tracking
- Mostrar un banner/toast fijo en la parte superior cuando `nearbyStop` no es null
- Incluir botones "Marcar Llegada" y "Ignorar"
- Al confirmar: actualizar `load_stops.arrived_at`, crear notificacion, y limpiar el estado
- Al ignorar: agregar el stop al set de "ya alertados"

**Archivo: `src/contexts/DriverTrackingContext.tsx` - Carga de datos**

- Nuevo efecto que busca la carga activa del driver y sus stops cuando `driverId` cambia o cuando se confirma una llegada
- Query: `loads` donde `driver_id = driverId` y status en estados activos, luego `load_stops` de esa carga
- Solo considerar stops que tengan `lat` y `lng` (coordenadas) y `arrived_at IS NULL`

**Formula de distancia (Haversine):**

```text
d = 2 * R * arcsin(sqrt(
  sin^2((lat2-lat1)/2) + cos(lat1) * cos(lat2) * sin^2((lng2-lng1)/2)
))
R = 6371000 metros
```

**Radio de deteccion:** 300 metros (configurable). Suficientemente amplio para cubrir areas industriales/warehouses sin generar falsos positivos.

### Flujo visual en la app movil

```text
+----------------------------------+
|  GPS  [Logo] Load Up Driver  [!] |
+----------------------------------+
| +------------------------------+ |
| | Estas cerca de:              | |
| | 123 Warehouse Rd, Dallas TX  | |
| | [Marcar Llegada]  [Ignorar]  | |
| +------------------------------+ |
|                                  |
|  ... contenido normal ...        |
+----------------------------------+
```

### Visibilidad en la app web

No se requieren cambios adicionales en la app web. La notificacion `driver_arrived` que ya existe se creara automaticamente al confirmar la llegada, y aparecera como toast en tiempo real para los dispatchers (sistema ya implementado).

### Archivos a modificar

1. `src/contexts/DriverTrackingContext.tsx` - Agregar geofencing logic, carga de stops activos, y funciones de confirmacion
2. `src/components/driver-app/DriverMobileLayout.tsx` - Agregar banner de proximidad con botones de accion
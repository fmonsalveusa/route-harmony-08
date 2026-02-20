

## Indicador de GPS del Driver en el Mapa de Detalle de Carga

### Que se hara
Agregar un marcador en tiempo real de la posicion GPS del conductor directamente en el mapa de cada carga (LoadDetailPanel), cuando el driver tenga el tracking activo (actualizado en los ultimos 5 minutos).

### Cambios

**Archivo: `src/components/LoadDetailPanel.tsx`**

1. Despues de inicializar el mapa y dibujar la ruta, consultar `driver_locations` para el `driver_id` de la carga
2. Si existe un registro con `updated_at` menor a 5 minutos, agregar un marcador pulsante (icono azul con "D" o icono de camion) en las coordenadas del driver
3. Suscribirse a cambios realtime en `driver_locations` filtrado por `driver_id` para mover el marcador en tiempo real cuando el driver se mueve
4. Mostrar un badge informativo "GPS Live" en el popup del marcador con la velocidad y ultima actualizacion
5. Limpiar la suscripcion realtime en el cleanup del useEffect

### Detalles tecnicos

- Se agregara un `useEffect` separado que depende de `load.driver_id` y `mapInstanceRef.current`
- El marcador del driver usara un `divIcon` con estilo pulsante (similar al de Tracking page) para diferenciarse de los marcadores P/D
- En cada actualizacion realtime, se mueve el marcador con `setLatLng()` en lugar de recrearlo
- El marcador incluye un popup con: nombre del driver, velocidad actual, y timestamp de la ultima posicion
- Si el tracking no esta activo (sin registro o > 5 min), no se muestra ningun marcador

### Resultado visual
En el mapa del detalle de carga, se vera un marcador azul pulsante con la posicion actual del conductor moviéndose en tiempo real, similar a como se ve en la pagina de Tracking pero integrado directamente en el mapa de la carga.


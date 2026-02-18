
# Panel de Timeline de Drivers con Cargas Asignadas en el Dashboard

## Que se va a construir
Un nuevo componente tipo Card en el Dashboard (admin y dispatcher) que muestre todos los drivers que tienen al menos una carga activa (dispatched, in_transit), cada uno con su mini-timeline horizontal mostrando las fechas de pickup y delivery de sus cargas asignadas.

## Diseno Visual
- Card con titulo "Drivers Load Timeline"
- Lista vertical de drivers (solo los que tienen cargas activas)
- Para cada driver: nombre + badge de status del driver + mini-timeline horizontal
- La timeline horizontal muestra cada carga como un segmento con:
  - Icono de pickup (fecha) a la izquierda
  - Linea conectora con referencia de carga y status badge
  - Icono de delivery (fecha) a la derecha
  - Color segun status: azul para dispatched, naranja para in_transit, verde para delivered
- Si un driver tiene multiples cargas, se apilan verticalmente dentro de su seccion
- Scroll vertical si hay muchos drivers

## Datos
- Se reutilizan los hooks existentes `useLoads()` y `useDrivers()` que ya estan en el Dashboard
- Se filtran las cargas con status `dispatched`, `in_transit` (y opcionalmente `delivered` recientes)
- Se agrupan por `driver_id`
- Solo se muestran drivers que tienen al menos 1 carga activa

## Cambios Tecnicos

### 1. Nuevo componente `src/components/dashboard/DriversTimelineCard.tsx`
- Props: `loads: DbLoad[]`, `drivers: DbDriver[]`
- Filtra cargas con status en ['dispatched', 'in_transit', 'delivered'] que tengan `driver_id`
- Agrupa cargas por `driver_id`
- Para cada driver con cargas, renderiza una seccion con:
  - Nombre del driver y cantidad de cargas activas
  - Timeline horizontal por cada carga mostrando pickup_date, delivery_date, referencia, origen, destino y status
- Usa `ScrollArea` para manejar overflow cuando hay muchos drivers
- Usa los componentes existentes `StatusBadge` y `Badge`

### 2. Modificar `src/pages/Dashboard.tsx`
- Importar `DriversTimelineCard`
- Agregar el componente en ambos dashboards (Admin y Dispatcher) despues de los charts y antes de la tabla "Recent Loads" / "My Loads"
- Pasar `loads` y `drivers` como props (ya disponibles en scope)

### Archivos a crear
- `src/components/dashboard/DriversTimelineCard.tsx`

### Archivos a modificar
- `src/pages/Dashboard.tsx`

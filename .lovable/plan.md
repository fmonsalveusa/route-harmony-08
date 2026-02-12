
# Edicion Manual del Origen de Millas Vacias (Empty Miles Origin)

## Problema
Actualmente, las millas vacias se calculan automaticamente desde la ultima entrega de la carga anterior del conductor. Pero en la realidad, el conductor puede haberse reubicado a otro lugar por diversas razones, haciendo que el calculo no refleje la distancia real recorrida.

## Solucion
Agregar un boton de edicion junto al campo "Empty Miles" en el panel de detalle de la carga (`LoadDetailPanel`) que permita al usuario escribir manualmente una nueva direccion de origen. Al confirmar, el sistema recalculara las millas vacias usando OSRM desde esa nueva direccion hasta el primer pickup de la carga.

## Cambios

### 1. UI en LoadDetailPanel.tsx
- Junto a la linea de "Empty Miles" y la direccion de origen, agregar un icono de edicion (lapiz).
- Al hacer clic, se abre un pequeno input inline o un popover donde el usuario puede escribir una nueva direccion.
- Incluir botones "Recalcular" y "Cancelar".

### 2. Logica de recalculo en LoadDetailPanel.tsx
- Al confirmar la nueva direccion:
  1. Geocodificar la direccion ingresada usando la funcion `geocode` existente.
  2. Calcular la distancia por carretera con `drivingDistance` hacia el primer pickup.
  3. Actualizar el estado local (`emptyMiles`, `emptyMilesOrigin`).
  4. Persistir en la base de datos (`loads.empty_miles`, `loads.empty_miles_origin`).
  5. Redibujar la linea punteada naranja en el mapa con el nuevo origen.

### 3. Sin cambios en base de datos
Los campos `empty_miles` y `empty_miles_origin` ya existen en la tabla `loads`, por lo que no se requieren migraciones.

## Detalles Tecnicos

- **Archivo a modificar**: `src/components/LoadDetailPanel.tsx`
- **Nuevos estados**: `editingEmptyOrigin` (boolean), `customOriginInput` (string)
- **Flujo**:
  - Click en icono de edicion -> muestra input con la direccion actual precargada
  - Usuario modifica la direccion -> click en "Recalcular"
  - Se geocodifica, calcula distancia, actualiza DB, y refresca el mapa
  - Si la geocodificacion falla, se muestra un toast de error
- **Componentes UI usados**: `Input`, `Button`, `Popover` (existentes en el proyecto)
- Se reutilizan las funciones `geocode`, `drivingDistance` y `drivingRoute` que ya existen en el componente

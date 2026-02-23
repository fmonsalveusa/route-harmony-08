

# Agrupar fotos por parada en la app web

## Problema actual
Cuando una carga tiene multiples paradas de delivery (o pickup), todas las fotos/escaneos se muestran mezcladas en una sola lista plana. Esto dificulta saber cual foto corresponde a cual parada, y complica el envio de fotos al broker por parada.

## Solucion
Modificar los componentes `PodUploadSection` y `PickupPicturesSection` para que agrupen los documentos por parada, mostrando la direccion de cada parada como encabezado de grupo. Cada grupo tendra su propio boton de "Seleccionar todo" y "Copiar al Clipboard", permitiendo copiar las fotos de una parada especifica para enviarlas al broker.

## Cambios tecnicos

### 1. `PodUploadSection.tsx` (POD - Delivery)
- Fetch los stops de delivery con su `address` y `stop_order` (no solo los IDs)
- Agrupar los `deliveryPods` por `stop_id`, creando secciones visuales
- Cada grupo muestra: etiqueta con numero de parada + direccion (ej: "Delivery #1 - 123 Main St, Dallas TX")
- Los documentos sin `stop_id` (legacy/null) se muestran en un grupo "Sin parada asignada"
- Cada grupo tiene su propio "Seleccionar todo" y "Copiar al Clipboard"
- El boton "Subir POD" global sigue funcionando igual

### 2. `PickupPicturesSection.tsx` (Pickup - BOL)
- Mismo patron: fetch stops de pickup con address/order
- Agrupar por `stop_id` con encabezado de parada
- Cada grupo con seleccion y copia independiente

### 3. Cargas con una sola parada
- Si solo hay 1 parada de pickup y 1 de delivery (caso comun), la UI se ve exactamente igual que ahora (sin encabezados redundantes)
- Los encabezados de grupo solo aparecen cuando hay 2+ paradas del mismo tipo

## Resultado visual

Para una carga con 2 deliveries:

```text
POD -- Proof of Delivery
  [Subir POD]

  Delivery #1 - 456 Oak Ave, Houston TX
    [Seleccionar todo]
    [x] foto1.jpg  [x] foto2.jpg
    [Copiar al Clipboard (2)]

  Delivery #2 - 789 Pine St, Austin TX
    [Seleccionar todo]
    [ ] foto3.jpg  [ ] foto4.jpg
```

## Notas
- No requiere cambios en la base de datos -- el campo `stop_id` en `pod_documents` ya existe y el driver app ya lo guarda correctamente
- La funcionalidad de copia secuencial se mantiene pero ahora opera por grupo de parada
- Los documentos legacy (sin stop_id) siguen siendo visibles

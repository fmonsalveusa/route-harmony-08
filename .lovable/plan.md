

# Mejora Visual del Sistema de Fotos/Documentos por Parada (Estilo SmartHop)

## Resumen
Redisenar la experiencia de carga de fotos y documentos dentro de cada StopCard para que sea mas visual, intuitiva y profesional. El sistema actual ya permite subir, ver y eliminar documentos por parada -- el objetivo es mejorar la presentacion y agregar funcionalidades de UX que faciliten el trabajo del conductor.

---

## Cambios Propuestos

### 1. Seccion de Documentos Expandida dentro del StopCard
- Reemplazar la grilla de thumbnails pequenos (64x64px) por una grilla mas grande y clara (80x80px) con bordes redondeados y sombra sutil
- Agregar un **contador de documentos** visible ("3 fotos") junto al titulo de la parada
- Mostrar el **nombre del archivo** debajo de cada thumbnail (truncado a 8 caracteres)

### 2. Botones de Accion Mejorados
- Reorganizar los botones de upload en un layout mas claro:
  - Boton principal grande: "Tomar Foto" (camara) con icono destacado
  - Boton secundario: "Galeria" para seleccionar de la galeria del telefono  
  - Boton de scanner (solo iOS/Desktop) con icono de documento
- Usar colores consistentes: azul para camara, gris para galeria, primario para scanner
- Agregar animacion de carga (skeleton) mientras se sube un archivo

### 3. Vista Previa Mejorada de Documentos
- Al tocar un thumbnail, mostrar una vista previa mas grande inline (expandible) en lugar de abrir una nueva pestana
- Agregar swipe/carousel horizontal cuando hay multiples fotos
- Mostrar timestamp de cuando se subio cada foto

### 4. Indicador Visual de Completitud
- Agregar un indicador de "documentos requeridos" por tipo de parada:
  - Pickup: Icono de check cuando hay al menos 1 foto de BOL
  - Delivery: Icono de check cuando hay al menos 1 POD
- Borde verde en la seccion de documentos cuando esta completa, gris cuando falta

### 5. Confirmacion de Eliminacion Mejorada
- Reemplazar los botones flotantes pequenos por un dialogo de confirmacion deslizable (swipe-to-delete) mas intuitivo en movil
- Mostrar el nombre del archivo en la confirmacion

---

## Detalles Tecnicos

### Archivos a Modificar
1. **`src/components/driver-app/StopCard.tsx`** - Rediseno completo de la seccion de documentos: grilla mas grande, botones reorganizados, contador, indicador de completitud, vista previa mejorada
2. **`src/pages/driver-app/DriverLoadDetail.tsx`** - Pasar conteo de documentos por parada al StopCard para el indicador visual

### Sin Cambios de Base de Datos
Toda la informacion necesaria ya existe en la tabla `pod_documents`. No se requieren migraciones.

### Sin Nuevos Archivos
Los cambios se concentran en el StopCard existente, manteniendo la logica de upload/delete/scanner actual.


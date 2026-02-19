
# Fix: Error 404 al abrir documentos escaneados

## Problema
Los documentos escaneados se suben correctamente al almacenamiento, pero al intentar abrirlos aparece un error 404. Esto ocurre porque:

1. **StopCard (upload directo con camara)** guarda una URL firmada temporal en la base de datos en vez de la ruta permanente del archivo. Cuando la URL expira, da 404.
2. **Los thumbnails de POD** en StopCard usan `file_url` directamente como enlace y fuente de imagen, pero cuando `file_url` es una ruta de almacenamiento (no una URL), no funciona.
3. **El hook `usePodDocuments`** ya tiene la logica correcta con `resolvePodUrl` para generar URLs firmadas bajo demanda, pero StopCard no lo usa.

## Solucion

### 1. StopCard - Corregir upload directo
En `handleFileUpload`, guardar solo la ruta de almacenamiento (`filePath`) en vez de la URL firmada. Eliminar la linea que genera la signed URL innecesaria.

Cambio: linea 85 de `file_url: urlData?.signedUrl || filePath` a `file_url: filePath`

### 2. StopCard - Thumbnails con URLs firmadas
Los thumbnails de POD actualmente usan `doc.file_url` directamente. Se necesita resolver las URLs bajo demanda:
- Agregar estado para URLs firmadas resueltas
- Al cargar los pods, generar signed URLs para mostrar thumbnails e iconos
- Al hacer click, abrir la URL firmada (no la ruta cruda)

### 3. Archivos a modificar
- **`src/components/driver-app/StopCard.tsx`**: 
  - Quitar la generacion de signed URL en upload (lineas 77-79)
  - Guardar solo `filePath` en `file_url`
  - Resolver URLs firmadas para los thumbnails de POD
  - Usar `onClick` con signed URL en vez de `href={doc.file_url}`

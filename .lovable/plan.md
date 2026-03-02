

## Plan: Generar PDF desde páginas escaneadas en el Document Scanner

### Problema actual
Cuando el conductor escanea un BOL/POD (una o varias páginas), cada página se sube como imagen JPEG individual. En la web, se ven como archivos de imagen separados, no como un documento PDF unificado.

### Solución

Modificar `handleUploadAll` en `DocumentScanner.tsx` para que, en lugar de subir cada página como imagen individual, combine todas las páginas escaneadas en un único archivo PDF usando `jsPDF` (ya instalado en el proyecto) y suba ese PDF como un solo `pod_document`.

### Cambios

#### 1. Crear utilidad `src/lib/scanToPdf.ts`
Nueva función que recibe un array de data URLs (imágenes) y devuelve un `Blob` de PDF:
- Usa `jsPDF` para crear un documento
- Cada imagen se agrega como una página completa (A4, orientación auto-detectada)
- Retorna el blob del PDF resultante

#### 2. Modificar `src/components/driver-app/DocumentScanner.tsx`
En `handleUploadAll`:
- Importar la nueva utilidad
- Recopilar todas las páginas (con su modo de visualización actual) en data URLs
- Llamar a `scanToPdf(dataUrls)` para generar el blob PDF
- Subir **un solo archivo** PDF al storage (`pods/{load_id}/{stop_id}_scan_{timestamp}.pdf`)
- Insertar **un solo registro** en `pod_documents` con `file_type: 'pdf'`

#### 3. Sin cambios en la web
`usePodDocuments` y `StopDocumentGroup`/`PodUploadSection` ya manejan archivos PDF correctamente (los abren con `window.open` via signed URL). El navegador mostrará el PDF nativo con todas las páginas.

### Resultado
- El conductor escanea 1 o N páginas → se genera 1 PDF
- En la web, el administrador ve un archivo PDF que puede abrir/descargar con todas las páginas del BOL/POD
- Compatible con el flujo de envío de facturas por email (que ya adjunta PODs)



## Copiar fotos al clipboard desde el detalle de cada carga

### Que se agrega
Checkboxes de seleccion en cada archivo de imagen en las secciones "Pick Up Pictures" y "POD" del panel de detalle de carga. Al seleccionar una o varias imagenes, aparece una barra de accion con un boton "Copiar al Clipboard". Al hacer clic, la imagen se copia al portapapeles para pegarla en un email, WhatsApp o cualquier otra app.

### Como funciona

1. Cada fila de archivo de imagen muestra un checkbox a la izquierda
2. Los PDFs no muestran checkbox (no se pueden copiar al clipboard)
3. Cuando hay al menos una imagen seleccionada, aparece una barra con "Copiar al Clipboard (N)"
4. Al hacer clic en "Copiar", se copia la primera imagen seleccionada al portapapeles
5. Si hay mas de una seleccionada, el boton cambia a "Copiar siguiente (2 de 3)" para avanzar por cada imagen
6. Un toast confirma cada copia exitosa
7. Boton "Seleccionar todo" / "Deseleccionar" en el header de cada seccion

### Detalles tecnicos

**Archivo nuevo: `src/lib/clipboardUtils.ts`**
- Funcion `copyImageToClipboard(imageUrl: string): Promise<boolean>`
  - Descarga la imagen como blob via `fetch()`
  - Dibuja en un canvas y exporta como PNG (unico formato que acepta `navigator.clipboard.write`)
  - Llama a `navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])`
  - Retorna true/false segun el resultado
  - Fallback: si el navegador no soporta Clipboard API, abre la imagen en nueva pestana

**Archivo modificado: `src/components/PickupPicturesSection.tsx`**
- Importar `Checkbox` de ui y `copyImageToClipboard` de clipboardUtils
- Agregar estado `selectedIds: Set<string>` y `copyIndex: number`
- Cada fila de imagen (file_type === 'image') muestra un Checkbox
- Header: boton "Seleccionar todo" cuando hay imagenes
- Barra flotante inferior con boton "Copiar al Clipboard" cuando hay seleccion
- Logica de copia secuencial: copia la imagen en `copyIndex`, avanza al siguiente, toast "Copiada 1 de N"

**Archivo modificado: `src/components/PodUploadSection.tsx`**
- Misma logica de checkboxes y copia que PickupPicturesSection
- Se pasa `selectedIds`, `onToggle`, `onCopy` como props al componente `PodFileList`
- La resolucion de URLs firmadas para el clipboard usa la misma funcion `resolveUrl` que ya existe en el hook `usePodDocuments`

**Flujo de copia:**
```text
Usuario selecciona imagenes -> clic "Copiar"
  -> Resuelve signed URL de la imagen
  -> fetch(signedUrl) -> blob
  -> canvas.drawImage() -> canvas.toBlob('image/png')
  -> navigator.clipboard.write([new ClipboardItem])
  -> toast("Copiada! Pega con Ctrl+V")
  -> Si hay mas: boton cambia a "Copiar siguiente (2 de 3)"
```

**Notas importantes:**
- La Clipboard API requiere HTTPS (ya lo tiene en produccion)
- Solo imagenes se pueden copiar; los PDFs se omiten
- El canvas convierte a PNG, que es el unico formato soportado por ClipboardItem
- No se necesitan cambios en la base de datos ni edge functions

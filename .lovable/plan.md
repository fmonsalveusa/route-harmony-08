
# Mejorar calidad de imagen del escáner en Samsung

## Problema
La cadena de procesamiento actual reduce la calidad de las fotos tomadas con Samsung (que capturan a 12MP+, ~4000x3000px) en varios puntos:

1. **`resizeForCrop` reduce a max 2048px** — pierde ~50% de la resolución original antes del recorte
2. **Re-compresión JPEG en cada paso** — calidad 0.85 en resize, 0.80 en B&W, 0.90 en color
3. **Cámara nativa a quality 92** — podría ser más alto para documentos
4. **Transformación de perspectiva usa nearest-neighbor** — genera bordes pixelados
5. **PDF final usa A4 fijo** — no aprovecha la resolución real de la imagen

## Cambios propuestos

### 1. `src/lib/nativeCamera.ts`
- Subir `quality` de 92 a **100** en `takeNativePhoto()` y `pickFromGallery()` — la compresión se aplica después en el pipeline

### 2. `src/lib/scannerImageUtils.ts`
- **`resizeForCrop`**: subir `maxDim` de 2048 a **3200** — conserva mucho más detalle del Samsung
- **`resizeForDetection`**: mantener en 1024 (solo se usa para la IA, no afecta calidad final)
- **`enhanceImage` (B&W)**: subir calidad JPEG de 0.80 a **0.92**
- **`enhanceImageColor`**: subir de 0.90 a **0.95**
- **`loadAndDraw` resize**: subir calidad default de 0.85 a **0.92**

### 3. `src/lib/perspectiveTransform.ts`
- Reemplazar **nearest-neighbor** por **bilinear interpolation real** (sampling de 4 píxeles vecinos con pesos) — elimina el pixelado en bordes y texto
- Subir calidad de salida de 0.92 a **0.95**

### 4. `src/lib/scanToPdf.ts`
- Añadir opción `compress: false` en `addImage()` de jsPDF para evitar re-compresión dentro del PDF
- Ya usa JPEG, así que la calidad se preserva mejor

## Resumen de impacto
- Las fotos de Samsung conservarán ~2.4x más resolución (3200 vs 2048)
- Menos artefactos de compresión en cada paso
- Texto más nítido después del recorte de perspectiva
- PDFs finales con mejor calidad visual

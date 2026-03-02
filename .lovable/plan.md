

## Plan: Mejorar calidad de escaneo en iPhone — modo color

### Problema
La función `enhanceImage` convierte las imágenes a escala de grises con un contraste agresivo (umbral binario), lo que degrada la calidad visual de documentos BOL/POD, especialmente en iPhone donde la cámara ya captura buena calidad.

### Cambios

**1. `src/lib/scannerImageUtils.ts` — Nueva función `enhanceImageColor`**
- Crear una función alternativa que mejore contraste y nitidez **sin convertir a blanco y negro**.
- Aplicar ajuste de brillo/contraste suave (curva S) y ligero aumento de saturación.
- Mantener la función `enhanceImage` original (B&W) como opción secundaria.

**2. `src/components/driver-app/DocumentScanner.tsx` — Toggle Color/B&W**
- Cambiar el comportamiento por defecto: al capturar, ya **no se aplica enhance automático** — se guarda la imagen original a color como vista principal.
- El botón "Mejorar" ahora cicla entre 3 estados: **Original → Color mejorado → Blanco y Negro**.
- Esto permite al conductor elegir la versión que mejor se vea según el documento.

**3. `src/lib/nativeCamera.ts` — Subir calidad en iPhone**
- Aumentar `quality` de 85 a 92 para capturas nativas, preservando más detalle en iOS.

### Detalle técnico

La nueva función `enhanceImageColor` aplicará:
- Ajuste de contraste con curva S suave (preserva tonos medios)
- Ligero incremento de saturación (+10%)
- Sin conversión a grises

El estado de cada `ScannedPage` cambiará de `{ original, enhanced, showEnhanced }` a `{ original, colorEnhanced, bwEnhanced, displayMode: 'original' | 'color' | 'bw' }`.


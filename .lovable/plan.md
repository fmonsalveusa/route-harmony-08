
# Escaner de Documentos Inteligente con Deteccion de Bordes

## Problema Actual
El escaner actual solo toma la foto completa y aplica un filtro de blanco y negro. No detecta los bordes del documento ni recorta el area relevante, resultando en imagenes con fondo innecesario (mesa, escritorio, etc.).

## Solucion Propuesta

Implementar un flujo de escaneo en 3 pasos:

1. **Captura** - El conductor toma la foto
2. **Deteccion y ajuste de bordes** - La IA detecta automaticamente las 4 esquinas del documento y muestra una vista previa con puntos arrastrables para que el conductor pueda ajustar si es necesario
3. **Recorte y mejora** - Se aplica transformacion de perspectiva para enderezar y recortar solo el documento, seguido del filtro de mejora existente

```text
+-------------------+     +-------------------+     +-------------------+
|  1. Tomar Foto    | --> |  2. Ajustar       | --> |  3. Resultado     |
|                   |     |  Esquinas         |     |  Recortado        |
|  [foto completa]  |     |  [4 puntos drag]  |     |  [solo documento] |
+-------------------+     +-------------------+     +-------------------+
```

## Detalle Tecnico

### 1. Edge Function: `detect-document-edges`
- Recibe la imagen capturada (base64)
- Usa **Gemini Vision** (modelo disponible en Lovable AI, sin API key necesaria) para detectar las 4 esquinas del documento
- Retorna las coordenadas (x,y) de cada esquina como porcentaje de la imagen
- Prompt de IA: "Identify the 4 corners of the paper document in this photo, return as JSON coordinates"

### 2. Nuevo componente: `EdgeCropOverlay`
- Muestra la imagen capturada con un overlay semi-transparente
- Dibuja 4 puntos (handles) en las esquinas detectadas por la IA
- Los puntos son **arrastrables** con touch/mouse para ajuste manual
- Muestra lineas conectando los 4 puntos para visualizar el area de recorte
- Botones: "Confirmar recorte" y "Omitir" (usar foto completa)

### 3. Transformacion de perspectiva (Canvas)
- Funcion `perspectiveTransform` que toma la imagen original + 4 coordenadas de esquinas
- Aplica una transformacion geometrica para convertir el cuadrilatero irregular en un rectangulo perfecto
- El resultado es una imagen recortada y enderezada del documento solamente
- Despues se aplica el filtro de mejora (blanco/negro con contraste) existente

### 4. Cambios al flujo del `DocumentScanner`
- Despues de capturar la foto, se muestra el `EdgeCropOverlay` en vez de ir directo al resultado
- Se agrega un estado intermedio `cropping` al flujo
- Si la IA no detecta bordes (ej: foto solo del documento sin fondo), permite continuar sin recorte
- El boton "Omitir" permite saltarse la deteccion si el conductor prefiere

### Archivos a crear/modificar:
- **Crear**: `supabase/functions/detect-document-edges/index.ts` - Edge function con Gemini Vision
- **Crear**: `src/components/driver-app/EdgeCropOverlay.tsx` - Componente de ajuste de esquinas
- **Crear**: `src/lib/perspectiveTransform.ts` - Logica de transformacion geometrica
- **Modificar**: `src/components/driver-app/DocumentScanner.tsx` - Integrar el nuevo flujo con el paso de recorte

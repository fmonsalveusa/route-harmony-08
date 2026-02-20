

# Plan: Solucion Robusta para Escaner en Android

## Problema
El pipeline de escaneo (deteccion de bordes, recorte, mejora) no funciona en el Android de Jorge. Las correcciones anteriores (ArrayBuffer, resize, spinner) no resolvieron el problema. Es probable que las funciones de canvas (`new Image()`, `canvas.toDataURL()`) fallen silenciosamente en ciertos dispositivos Android.

## Solucion (3 partes)

### 1. Modo "Escaneo Rapido" (fallback garantizado)
Agregar un tercer boton **"Subir directo"** que salta todo el pipeline de procesamiento (sin deteccion de bordes, sin recorte, sin perspectiva) y solo aplica la mejora de contraste basica antes de subir. Esto garantiza que Jorge pueda subir documentos aunque el pipeline completo falle.

### 2. Reemplazar `new Image()` con `createImageBitmap`
La funcion `new Image()` con data URLs grandes falla silenciosamente en muchos navegadores Android. `createImageBitmap()` es una API nativa del navegador mas robusta y asincrona que maneja mejor imagenes grandes. Se actualizaran las funciones `resizeForCrop`, `resizeForDetection`, y `enhanceImage` para usar esta API.

### 3. Flujo de App Externa
Agregar instrucciones claras en la interfaz para que Jorge pueda usar apps como Google Drive Scanner, Adobe Scan, o la app de camara nativa de Samsung/Google (que incluyen modo documento), y luego seleccionar la imagen ya escaneada con el boton "Galeria".

---

## Detalles Tecnicos

### Cambios en `src/components/driver-app/DocumentScanner.tsx`

**a) Nueva funcion `createImageBitmapSafe`:**
```text
- Wrapper que usa createImageBitmap cuando esta disponible
- Fallback a new Image() si no esta soportado
- Convierte Blob directamente sin pasar por data URL cuando es posible
```

**b) Refactorizar funciones de canvas:**
- `resizeForCrop()`: Usar `createImageBitmap` + `OffscreenCanvas` o canvas regular
- `resizeForDetection()`: Mismo cambio
- `enhanceImage()`: Mismo cambio
- `fileToDataUrl()`: Agregar opcion de retornar Blob directamente para evitar conversion innecesaria a base64

**c) Nuevo boton "Subir directo":**
```text
- Abre el picker de camara/galeria
- Comprime la imagen con compressImage() existente
- Sube directamente sin pasar por crop overlay ni edge detection
- Muestra toast de confirmacion
```

**d) Mensaje informativo:**
- Al abrir el escaner, mostrar un tip: "Para mejor calidad, escanea primero con tu app de camara y luego selecciona desde Galeria"

### Flujo actualizado en Android

```text
Usuario abre "Scanear BOL"
  |
  +-- Opcion 1: "Camara" -> intenta pipeline completo (con createImageBitmap)
  |     Si funciona -> crop overlay -> mejora -> subir
  |     Si falla -> fallback automatico a subida directa
  |
  +-- Opcion 2: "Galeria" -> seleccionar imagen ya escaneada -> pipeline completo
  |
  +-- Opcion 3: "Subir directo" -> tomar/seleccionar foto -> comprimir -> subir sin procesamiento
```

### Archivos a modificar
- `src/components/driver-app/DocumentScanner.tsx` - Logica principal, nuevo boton, createImageBitmap, fallback automatico

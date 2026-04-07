

## Diagnóstico

Los botones de **Cámara** y **Galería** (tanto en StopCard como en DocumentScanner) no funcionan porque:

1. **En la app nativa iOS**: `handleNativeCamera` y `handleNativeGallery` en StopCard **no tienen try-catch** — si el plugin de Capacitor Camera falla o lanza un error, el botón no hace nada y no muestra ningún mensaje de error al usuario.

2. **En Safari web (pruebas)**: `Capacitor.isNativePlatform()` retorna `false`, así que los botones renderizan `<label>` con `<input type="file">`. El atributo `capture="environment"` puede causar problemas en ciertas versiones de iOS Safari, y en iframes (como el preview de Lovable) los inputs de archivo programáticos pueden ser bloqueados.

3. **En DocumentScanner**: `triggerCamera()` y `triggerGallery()` usan `.click()` programático en inputs ocultos (fallback web), lo cual iOS Safari puede bloquear fuera de un evento de usuario directo.

## Plan de corrección

### 1. Agregar manejo de errores robusto en StopCard
- Envolver `handleNativeCamera` y `handleNativeGallery` en try-catch con toasts de error visibles
- Si el plugin nativo falla, hacer **fallback automático** al `<input type="file">` del navegador (web fallback)

### 2. Agregar fallback web en StopCard cuando la cámara nativa falle
- Mantener un `ref` a inputs de archivo ocultos (camera + gallery) como respaldo
- Si `takeNativePhoto()` o `pickFromGallery()` lanzan error (no cancelación), disparar el input de archivo como alternativa

### 3. Mejorar DocumentScanner con el mismo patrón
- Agregar try-catch con toast en `triggerCamera()` y `triggerGallery()` 
- Asegurar que los refs de input se disparen correctamente como fallback

### 4. Remover `capture="environment"` del input de cámara web
- En iOS Safari, este atributo puede causar que el input no responda. Usar solo `accept="image/*"` para máxima compatibilidad.

### Archivos a modificar
- `src/components/driver-app/StopCard.tsx` — error handling + fallback refs
- `src/components/driver-app/DocumentScanner.tsx` — error handling mejorado  
- `src/lib/nativeCamera.ts` — sin cambios necesarios (ya tiene error handling interno)

### Resultado esperado
Los botones mostrarán un mensaje de error si algo falla, e intentarán abrir la cámara/galería del navegador como alternativa. Esto funciona tanto en la app nativa como en Safari.


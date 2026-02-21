

# Plan: Deshabilitar Escaner en Android, mantenerlo en iPhone

## Resumen
Detectar si el dispositivo es Android usando `navigator.userAgent`. En Android, ocultar el boton "Scanear BOL/POD" para que los conductores solo usen el boton de camara/galeria nativo. En iPhone (iOS), el boton del escaner seguira visible y funcional como siempre.

## Cambios

### Archivo: `src/components/driver-app/StopCard.tsx`

1. Agregar una variable que detecte si el dispositivo es Android:
   ```
   const isAndroid = /android/i.test(navigator.userAgent);
   ```

2. Envolver el boton "Scanear BOL / Scanear POD" (linea ~276) en una condicion `{!isAndroid && (...)}` para que solo se muestre en dispositivos que NO son Android (es decir, iPhone/iPad/desktop).

3. El componente `DocumentScanner` y su import pueden quedarse sin cambios ya que simplemente nunca se abrira en Android.

### Resultado
- **Android**: Solo vera el boton de camara/galeria nativo para subir fotos directamente.
- **iPhone/iPad/Desktop**: Vera el boton "Scanear BOL/POD" con el pipeline completo de escaneo (recorte, mejora de contraste, etc.).


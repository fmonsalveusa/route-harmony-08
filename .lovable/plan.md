

# Fix: Botones ocultos por barra de navegación Samsung

## Problema
Los botones "Omitir Recorte" y "Confirmar Recorte" del `EdgeCropOverlay`, así como los botones del `DocumentScanner`, quedan detrás de la barra de navegación de Samsung. El `env(safe-area-inset-bottom)` no funciona correctamente en el WebView de Android porque Capacitor no siempre expone esa variable CSS.

## Solución
Cambiar la estrategia: en lugar de depender de `env(safe-area-inset-bottom)` (que no reporta valores en Android WebView), usar un padding fijo más agresivo (80px) combinado con el safe-area como fallback. Esto garantiza espacio suficiente incluso con barras de navegación por gestos o botones virtuales de Samsung.

## Cambios

### 1. `src/components/driver-app/EdgeCropOverlay.tsx`
- Cambiar el `style` del contenedor de botones de:
  `paddingBottom: 'max(env(safe-area-inset-bottom, 56px), 56px)'`
  a:
  `paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)'`

### 2. `src/components/driver-app/DocumentScanner.tsx`
- Cambiar el `style` del contenedor de acciones (línea 451) de:
  `paddingBottom: 'max(env(safe-area-inset-bottom, 40px), 40px)'`
  a:
  `paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)'`

Esto suma 80px de espacio fijo **más** cualquier safe-area que el sistema reporte, asegurando que los botones queden siempre visibles por encima de cualquier barra de navegación de Android.


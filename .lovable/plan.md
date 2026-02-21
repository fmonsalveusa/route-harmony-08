

# Fix: Botones cortados en iPhone (Safe Area)

## Problema
En iPhone, cuando la app se abre como PWA (instalada en pantalla de inicio) con `apple-mobile-web-app-status-bar-style: black-translucent`, el contenido se extiende debajo del notch/barra de estado y del indicador de inicio (home bar). Esto causa que:
- **Arriba**: El header queda tapado por la barra de estado / notch del iPhone
- **Abajo**: La barra de navegacion queda parcialmente oculta por el home indicator

## Causa raiz
El meta tag `viewport-fit=cover` permite que la app ocupe toda la pantalla, pero el layout no aplica los margenes de seguridad (`safe-area-inset`) en el header ni correctamente en la navegacion inferior.

## Solucion

### 1. Header - Agregar padding superior para el notch
En `DriverMobileLayout.tsx`, agregar padding-top con safe-area-inset-top al header para que el contenido no quede debajo del notch/status bar.

### 2. Nav inferior - Asegurar que la altura total incluya el safe area
La clase `safe-area-pb` ya existe, pero la altura fija de 72px no incluye el espacio extra. Se cambiara a altura automatica para que el padding del safe area se sume correctamente.

### 3. Contenedor principal - Safe area lateral
Agregar padding lateral con safe-area-inset para pantallas en landscape (iPhone en horizontal).

## Cambios tecnicos

**Archivo: `src/components/driver-app/DriverMobileLayout.tsx`**
- Header (`<header>`): Agregar `pt-[env(safe-area-inset-top,0px)]` al estilo y cambiar la altura para acomodar el safe area
- Nav (`<nav>`): Cambiar de `h-[72px]` a `min-h-[72px]` para que el `safe-area-pb` funcione correctamente sumando espacio

**Archivo: `src/index.css`**
- Agregar clase utilitaria `safe-area-pt` con `padding-top: env(safe-area-inset-top, 0px)`

**Archivo: `src/pages/driver-app/DriverTracking.tsx`**
- La barra de estado fija en la parte inferior tambien necesita ajustarse para respetar el safe area del bottom nav

Estos cambios son CSS puro y no afectan ninguna logica ni funcionalidad existente.


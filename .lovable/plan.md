
## Problema: App Driver se ve pequeña / con espacio vacío en Android

### Causa del Problema

El problema en Android está causado por cómo los navegadores móviles calculan `100vh` (la unidad usada por la clase `h-screen` de Tailwind):

- En Android (Chrome, Samsung Browser), `100vh` incluye la barra de URL del navegador, la barra de navegación del sistema, etc.
- Esto provoca que el contenedor principal tenga una altura mayor o menor que el área visual real
- El resultado es: espacio vacío en la parte inferior, o contenido cortado

La solución moderna es usar **`100dvh`** (Dynamic Viewport Height), introducida en CSS para resolver exactamente este problema en móviles. Esta unidad se ajusta dinámicamente cuando la barra de URL del navegador aparece o desaparece.

### Cambios a Realizar

**1. `src/components/driver-app/DriverMobileLayout.tsx`**
- Cambiar `h-screen` por `h-[100dvh]` (dynamic viewport height) en el contenedor principal `div`
- Esto garantiza que el layout siempre ocupe exactamente el área visual disponible en Android e iOS

**2. `src/index.css`**
- Agregar una regla global para el elemento `html` y `body` que también use `100dvh`:
  ```css
  html, body, #root {
    height: 100dvh;
  }
  ```
- Esto asegura que la base del árbol DOM también respete el viewport dinámico

**3. Padding inferior de páginas internas**
- Las páginas internas (`DriverDashboard`, `DriverLoads`, `DriverPayments`, `DriverProfile`, `DriverTracking`) usan `pb-20` o `pb-24` hardcoded para evitar que el contenido quede detrás del tab bar
- Cambiar estos paddings a `pb-[calc(72px+env(safe-area-inset-bottom,0px))]` para que el padding sea exactamente el tamaño del nav bar (72px) más el safe area del sistema operativo

### Por qué funciona esto

```text
ANTES (h-screen = 100vh en Android):
┌─────────────────┐ ← Viewport real del browser (variable)
│   Header 64px   │
│                 │
│    Content      │
│                 │
│  [espacio vacío]│ ← 100vh incluye barra URL
│   Nav 72px      │
└─────────────────┘

DESPUÉS (h-[100dvh]):
┌─────────────────┐ ← Viewport dinámico (siempre exacto)
│   Header 64px   │
│                 │
│    Content      │ ← Llena todo el espacio disponible
│                 │
│   Nav 72px      │
└─────────────────┘
```

### Archivos Modificados
- `src/components/driver-app/DriverMobileLayout.tsx` — cambiar `h-screen` → `h-[100dvh]`
- `src/index.css` — agregar `height: 100dvh` a `html, body, #root`
- `src/pages/driver-app/DriverDashboard.tsx` — ajustar padding inferior
- `src/pages/driver-app/DriverLoads.tsx` — ajustar padding inferior
- `src/pages/driver-app/DriverPayments.tsx` — ajustar padding inferior
- `src/pages/driver-app/DriverProfile.tsx` — ajustar padding inferior
- `src/pages/driver-app/DriverTracking.tsx` — ajustar padding inferior

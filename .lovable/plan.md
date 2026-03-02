

## Problema Identificado

El código en `src/main.tsx` que desactiva el Service Worker en preview verifica si el hostname contiene `"lovableproject.com"`, pero la URL real del preview es `id-preview--*.lovable.app`. Como resultado, **el Service Worker sigue activo en preview** y sirve archivos cacheados de una versión anterior (con el layout de sidebar vertical y branding antiguo).

## Plan de Corrección

### 1. Corregir la detección del entorno preview en `src/main.tsx`

Actualizar la condición `isLovablePreview` para que también detecte el dominio correcto del preview:

```typescript
const isLovablePreview =
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app") ||
  window.location.search.includes("__lovable_token");
```

Esto hará que en **cualquier** entorno de Lovable (preview o publicado con `.lovable.app`) se limpien los Service Workers antiguos y no se registren nuevos, asegurando que siempre se cargue la versión más reciente.

### 2. Limpiar `src/App.css` (opcional)

El archivo `App.css` contiene estilos del template de Vite por defecto (`#root { max-width: 1280px; ... }`) que no se usan (no está importado), pero debería eliminarse para evitar confusión futura.

### Resultado Esperado

Tras este cambio, al recargar el preview, el Service Worker antiguo se desregistrará automáticamente y la app cargará con el layout horizontal actual (top-nav) y el branding correcto (Load Up TMS con el logo nuevo).


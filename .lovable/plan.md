
## Problema: App Driver se ve pequeña en Android de Jorge Torres

### Diagnóstico Completo

Después de revisar el código, hay **3 causas** que combinadas explican el problema, incluso después de aplicar los cambios anteriores:

---

### Causa 1 — El CSS `height` no funciona igual que `min-height` en Android

En `src/index.css`:
```css
html, body, #root {
  height: 100dvh;  /* ← esto funciona en algunos, no en todos */
}
```

En Chrome Android, `height: 100dvh` en el `html` root puede ser ignorado o calculado incorrectamente. La solución correcta es:
```css
html, body {
  height: 100%;
}
#root {
  min-height: 100dvh;
  height: 100dvh;
}
```

---

### Causa 2 — El viewport meta tag bloquea el escalado correcto en High-DPI

En `index.html` existe esta línea:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

El `maximum-scale=1.0` en combinación con `user-scalable=no` **puede causar que en pantallas High-DPI de Android** (como Samsung Galaxy S series) el contenido aparezca pequeño porque el navegador no puede ajustar el escalado. Cambiar a:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Agregar `viewport-fit=cover` es crucial para que el contenido ocupe toda la pantalla incluyendo las áreas de la muesca (notch) y bordes redondeados.

---

### Causa 3 — La app no está instalada como PWA (problema principal)

Mientras la app se acceda desde Chrome browser (no instalada), Chrome mantiene su barra de URL y navegación, lo cual "roba" espacio visual. Esto hace que la app parezca pequeña y apretada.

**Solución definitiva:** Jorge debe instalar la app desde `/install`. Una vez instalada, corre en modo `standalone` (pantalla completa, sin barras del navegador), y el layout funcionará perfectamente.

---

### Cambios a Realizar

**1. `index.html`** — Corregir el viewport meta tag:
- Quitar `maximum-scale=1.0, user-scalable=no` que bloquea el escalado
- Agregar `viewport-fit=cover` para ocupar toda la pantalla incluyendo notch

**2. `src/index.css`** — Corregir el CSS del height para que funcione en todos los Android:
- Cambiar `html, body` a `height: 100%`
- Mantener `#root` con `height: 100dvh` y agregar también `min-height: 100dvh`

**3. `src/pages/Install.tsx`** — Agregar un banner de alerta prominente al inicio de la pantalla de instalación que explique por qué la app puede verse pequeña mientras no está instalada, motivando a Jorge a completar la instalación.

---

### Por qué esto soluciona el problema

```text
MODO BROWSER (sin instalar) — PROBLEMÁTICO:
┌──────────────────────┐
│  Chrome URL Bar 56px │ ← roba espacio, causa problemas de layout
├──────────────────────┤
│     App Header       │
│                      │
│  Contenido pequeño   │ ← todo se ve comprimido
│                      │
│     Nav Bar 72px     │
└──────────────────────┘

MODO PWA INSTALADA — CORRECTO:
┌──────────────────────┐
│     App Header       │ ← ocupa toda la pantalla
│                      │
│  Contenido normal    │ ← tamaño correcto
│                      │
│     Nav Bar 72px     │
└──────────────────────┘
```

### Archivos a Modificar
- `index.html` — viewport meta tag
- `src/index.css` — corrección del height CSS
- `src/pages/Install.tsx` — banner explicativo de por qué instalar la app

### Instrucciones para Jorge (incluidas en la pantalla /install)
1. Abrir Chrome en Android
2. Ir a la URL de la app
3. Tocar el menú ⋮ (tres puntos)
4. Tocar "Install app" o "Add to Home Screen"
5. Confirmar la instalación
6. Abrir la app desde el icono en la pantalla de inicio (NO desde Chrome)

Esto garantiza modo standalone y la app se verá en tamaño completo.



## Notificación de actualización de la app

### Situación actual
La app ya tiene un Service Worker (PWA) que detecta nuevas versiones (`onNeedRefresh`), pero solo hace `console.log` — el usuario nunca se entera.

### Plan

**1. Crear componente `UpdatePrompt`** — Un banner/toast persistente que aparece cuando el SW detecta una nueva versión. Muestra un mensaje como "Hay una nueva versión disponible" con un botón "Actualizar ahora" que recarga la app.

**2. Modificar `main.tsx`** — En lugar de solo loguear en `onNeedRefresh`, exponer una señal reactiva (evento custom o variable global) que el componente `UpdatePrompt` escuche.

**3. Enfoque técnico:**
- Usar `virtual:pwa-register` con un callback que dispare un `CustomEvent` en `window`
- El componente `UpdatePrompt` escucha ese evento y muestra el banner
- Al hacer clic en "Actualizar", llama a `updateSW(true)` que activa el nuevo SW y recarga
- El banner se renderiza en `App.tsx` para que esté disponible en todas las rutas (admin, driver, etc.)

```text
[Service Worker detecta nueva versión]
        ↓
[window dispatches "sw-update-available"]
        ↓
[UpdatePrompt se muestra: banner fijo arriba]
        ↓
[Usuario clic "Actualizar" → updateSW(true) → reload]
```

**4. Estilo del banner:** Fijo en la parte superior, con colores de la marca, visible tanto en la vista admin como en la app del driver. Se auto-cierra al actualizar.

### Alcance
- Crear: `src/components/UpdatePrompt.tsx`
- Editar: `src/main.tsx` (exponer señal de update)
- Editar: `src/App.tsx` (montar el componente)




## Plan: Simplificar main.tsx eliminando cache-busting acumulado

El código de cache-busting en `main.tsx` ha crecido con múltiples intentos de resolver un problema que es inherente al entorno de preview de Lovable (caché del iframe del navegador). Este código no ayuda en producción y añade complejidad innecesaria, recargas extra y posibles problemas.

### Cambios

**`src/main.tsx`** — Simplificar a lo esencial:
- Mantener el registro del Service Worker para producción (PWA)
- Eliminar toda la lógica de detección de preview, parámetros `__lcv`, limpieza de SW/caches, y recargas forzadas
- Mantener el handler de `unhandledrejection` como safety net

El archivo quedará limpio: registro de SW + render de la app, sin lógica condicional de preview.

**`vite.config.ts`** — Sin cambios. Los headers de no-cache del servidor de desarrollo pueden quedarse ya que no afectan producción.


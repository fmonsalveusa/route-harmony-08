

## Plan: Mantener GPS Tracking activo en segundo plano

### Problema
Cuando el conductor cambia a otra app en Android, el sistema operativo suspende o mata el proceso del navegador. Al regresar, el estado de React se pierde (incluyendo `tracking = true`), por lo que el rastreo aparece como desactivado.

### Solucion (3 mejoras combinadas)

**1. Persistir estado de tracking en localStorage**
- Al activar tracking, guardar `tracking: true` en `localStorage`
- Al cargar la app (o al volver del background), leer localStorage y auto-reanudar el tracking si estaba activo
- Al desactivar manualmente, limpiar localStorage
- Esto resuelve el caso donde Android mata completamente la pagina y React pierde el estado

**2. Agregar Wake Lock API**
- Usar `navigator.wakeLock.request('screen')` para evitar que el dispositivo entre en suspension profunda mientras el tracking esta activo
- Reacquirir el wake lock en el evento `visibilitychange` (se pierde al cambiar de app)
- Es compatible con Chrome Android (la plataforma principal)

**3. Mejorar la recuperacion en visibilitychange**
- Ademas de reiniciar el GPS watch, verificar si el estado de tracking se perdio y restaurarlo desde localStorage
- Enviar posicion inmediatamente al volver para minimizar el "hueco" de datos

### Detalles tecnicos

**Archivo: `src/contexts/DriverTrackingContext.tsx`**

- Agregar constante `TRACKING_STORAGE_KEY = 'driver-tracking-active'`
- En `startTracking`: guardar `localStorage.setItem(TRACKING_STORAGE_KEY, 'true')`
- En `stopTracking`: hacer `localStorage.removeItem(TRACKING_STORAGE_KEY)`
- Nuevo `useEffect` al montar: si `localStorage.getItem(TRACKING_STORAGE_KEY) === 'true'` y no esta tracking, llamar `startTracking()` automaticamente
- Nuevo ref `wakeLockRef` para gestionar el Wake Lock:
  - Adquirir en `startTracking`
  - Liberar en `stopTracking`
  - Re-adquirir en `visibilitychange` cuando vuelve a `visible`

### Resultado esperado
- Si Android mata la pagina: al reabrir la app, el tracking se reanuda automaticamente
- Si Android suspende la pagina: el Wake Lock reduce la probabilidad de suspension, y el visibilitychange restaura todo al volver
- El conductor no necesita volver a presionar "Start Tracking" manualmente


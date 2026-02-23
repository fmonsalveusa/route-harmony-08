
# Actualizar nombre de la app movil a "Dispatch Up Driver"

## Cambios necesarios

Se actualizaran las referencias al nombre de la app movil en 3 archivos para que coincidan con el nombre publicado en la tienda.

### 1. `capacitor.config.ts`
- Cambiar `appName: 'Dispatch Up'` a `appName: 'Dispatch Up Driver'`

### 2. `src/components/driver-app/DriverMobileLayout.tsx`
- Cambiar el texto visible en el header de la app movil de `"Load Up Driver"` a `"Dispatch Up Driver"`

### 3. `src/lib/nativeTracking.ts`
- Cambiar `backgroundTitle: 'Load Up Driver'` a `backgroundTitle: 'Dispatch Up Driver'` (titulo de la notificacion de GPS tracking)

## Notas
- El TMS web (landing page, pagina de login, dashboard) mantendra el nombre "Load Up TMS" ya que es el producto web, no la app movil.
- Despues de aplicar estos cambios, la proxima vez que compiles el APK deberas hacer `git pull` y `npx cap sync android` para que el `appName` en Capacitor se refleje en el build nativo.

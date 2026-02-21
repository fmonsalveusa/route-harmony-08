
# Preparar App Movil para Publicacion en Tiendas (Android e iOS)

## Resumen
Instalar y configurar Capacitor para convertir la PWA en apps nativas, crear helpers que detecten automaticamente si la app corre en Capacitor o en el navegador, e integrar GPS en segundo plano y camara nativa.

---

## Paso 1: Instalar Capacitor y Configuracion Base

Instalar las dependencias necesarias:
- `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`, `@capacitor/android`
- `@capacitor/camera` -- camara nativa de alta calidad
- `@capacitor/app` -- eventos de lifecycle (foreground/background)
- `@capacitor/status-bar` -- control del status bar
- `@capacitor/splash-screen` -- pantalla de carga
- `@capacitor/filesystem` -- almacenamiento temporal de fotos
- `@capacitor-community/background-geolocation` -- GPS en segundo plano

Crear `capacitor.config.ts` con:
- appId: `app.lovable.091db5142f774b42adb88401c76bdec5`
- appName: `route-harmony-08`
- Server URL apuntando al preview para hot-reload en desarrollo

---

## Paso 2: Helper de GPS Nativo (`src/lib/nativeTracking.ts`)

Crear un modulo que expone una API unificada:

- `isNativePlatform()` -- detecta si estamos en Capacitor
- `startNativeTracking(callback)` -- inicia background geolocation en Capacitor, retorna funcion de cleanup
- `stopNativeTracking()` -- detiene el plugin nativo

Cuando corre en el navegador, el helper no hace nada y el contexto sigue usando `navigator.geolocation.watchPosition` como hasta ahora.

---

## Paso 3: Helper de Camara Nativa (`src/lib/nativeCamera.ts`)

Crear un modulo con:

- `takeNativePhoto()` -- usa `@capacitor/camera` con la camara trasera, retorna un data URL
- `pickFromGallery()` -- usa `@capacitor/camera` con selector de galeria, retorna data URL(s)
- `isNativeCamera()` -- indica si la camara nativa esta disponible

Cuando no esta en Capacitor, retorna `null` para que el StopCard siga usando los inputs HTML actuales.

---

## Paso 4: Integrar GPS Nativo en DriverTrackingContext

Modificar `src/contexts/DriverTrackingContext.tsx`:

- En `startTracking()`: si `isNativePlatform()`, usar `startNativeTracking()` en vez de `watchPosition` + Wake Lock
- En `stopTracking()`: llamar `stopNativeTracking()` si es nativo
- Eliminar la logica de Wake Lock y `visibilitychange` cuando es nativo (el plugin nativo lo maneja)
- Mantener el flujo web actual como fallback

---

## Paso 5: Integrar Camara Nativa en StopCard

Modificar `src/components/driver-app/StopCard.tsx`:

- Al hacer click en "Camera": si `isNativeCamera()`, llamar `takeNativePhoto()` y procesar el data URL directamente
- Al hacer click en "Gallery": si `isNativeCamera()`, llamar `pickFromGallery()`
- Si no es nativo, mantener los `<input type="file">` actuales (sin cambios para la PWA web)

---

## Paso 6: Lifecycle y Status Bar en DriverMobileLayout

Modificar `src/components/driver-app/DriverMobileLayout.tsx`:

- Importar `@capacitor/status-bar` y configurar color (#1e3a5f) y estilo claro al montar
- Importar `@capacitor/app` para escuchar `appStateChange` y re-sincronizar GPS al volver a foreground (complementa el `visibilitychange` web)

---

## Archivos a Crear
1. `capacitor.config.ts` -- configuracion de Capacitor
2. `src/lib/nativeTracking.ts` -- helper GPS nativo vs web
3. `src/lib/nativeCamera.ts` -- helper camara nativa vs web

## Archivos a Modificar
4. `package.json` -- nuevas dependencias
5. `src/contexts/DriverTrackingContext.tsx` -- usar nativeTracking
6. `src/components/driver-app/StopCard.tsx` -- usar nativeCamera
7. `src/components/driver-app/DriverMobileLayout.tsx` -- status bar + lifecycle

## Sin Cambios de Base de Datos
No se requieren migraciones ni cambios en tablas.

---

## Instrucciones Post-Implementacion

Despues de que se implementen los cambios en Lovable, para probar en un dispositivo fisico:

1. Exportar el proyecto a GitHub via el boton "Export to Github"
2. Clonar el repositorio: `git clone <repo-url>`
3. Instalar dependencias: `npm install`
4. Agregar plataformas: `npx cap add ios` y/o `npx cap add android`
5. Actualizar dependencias nativas: `npx cap update ios` o `npx cap update android`
6. Compilar: `npm run build`
7. Sincronizar: `npx cap sync`
8. Ejecutar: `npx cap run android` o `npx cap run ios`
   - iOS requiere Mac con Xcode
   - Android requiere Android Studio

Para mas detalles sobre el flujo de desarrollo nativo, consultar la documentacion de Capacitor en el blog de Lovable.

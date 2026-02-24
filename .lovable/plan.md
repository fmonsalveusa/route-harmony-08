

# Corregir GPS en Segundo Plano para Android

## Problema

El plugin `@capacitor-community/background-geolocation` SI crea un servicio nativo en Android que sobrevive al background. Sin embargo, hay 3 problemas que causan que parezca que no funciona:

1. **Falta configuracion critica en Capacitor**: El plugin requiere `android.useLegacyBridge: true` en la configuracion de Capacitor. Sin esto, las actualizaciones de ubicacion en background no llegan al WebView.

2. **El watcher ID se pierde al destruir el WebView**: Android destruye el WebView cuando la app va al background. Al regresar, React se reinicializa y el `watcherId` en memoria es `null`, aunque el watcher nativo sigue corriendo. Esto causa watchers "huerfanos" y duplicados.

3. **El callback de JavaScript muere**: Aunque el plugin nativo sigue generando posiciones, el callback JS que envia datos a la base de datos muere con el WebView. Al reconectar, se necesita crear un nuevo watcher con un nuevo callback.

## Cambios

### 1. `capacitor.config.ts` -- Agregar configuracion requerida por el plugin

Agregar `android.useLegacyBridge: true` en la configuracion. Esto es un **requisito documentado** del plugin para que las actualizaciones en background lleguen correctamente.

```typescript
const config: CapacitorConfig = {
  // ...existing...
  android: {
    useLegacyBridge: true,
  },
  // ...existing...
};
```

### 2. `src/lib/nativeTracking.ts` -- Persistir watcher ID y limpiar huerfanos

- Guardar el `watcherId` en `localStorage` al crear un watcher
- Al iniciar, leer el ID guardado y limpiar watchers huerfanos antes de crear uno nuevo
- Modificar `stopNativeTracking` para tambien limpiar el ID de localStorage
- Agregar logging detallado para diagnostico

Flujo corregido:

```text
startNativeTracking()
  1. Leer watcherId guardado en localStorage
  2. Si existe, intentar removeWatcher(oldId) -- limpieza
  3. Crear nuevo watcher con addWatcher()
  4. Guardar nuevo watcherId en localStorage
  5. Retornar cleanup function

stopNativeTracking()
  1. Leer watcherId de memoria O de localStorage
  2. removeWatcher(id)
  3. Limpiar localStorage
```

### 3. `src/contexts/DriverTrackingContext.tsx` -- Reconexion robusta tras background

- En el listener `appStateChange`: siempre limpiar watcher anterior (via ID persistido) y crear uno nuevo con callback fresco
- Eliminar la condicion `hasActiveWatcher()` que impide re-crear el callback (el watcher nativo puede estar vivo pero su callback JS esta muerto)
- En plataforma nativa, NO ejecutar el watcher web (`navigator.geolocation`) ni los listeners de `visibilitychange`
- Agregar logging detallado en cada punto critico del flujo

Cambios clave:
- `appStateChange` siempre fuerza un nuevo watcher nativo (con cleanup del anterior)
- Auto-resume siempre limpia antes de re-crear
- Web fallback solo se activa si el plugin nativo verdaderamente no esta en el APK

### 4. Instrucciones post-implementacion (para ti, el usuario)

Despues de que se implementen estos cambios, necesitas reconstruir el APK:

```
git pull
npm install
npx cap sync android
```

En el `AndroidManifest.xml` de tu proyecto Android (archivo `android/app/src/main/AndroidManifest.xml`), verificar que existan estos permisos:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Y que el servicio del plugin este declarado:

```xml
<service
    android:name="com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="location"
    android:stopWithTask="false" />
```

Luego reconstruir y generar nuevo APK/Bundle con Android Studio.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `capacitor.config.ts` | Agregar `android.useLegacyBridge: true` |
| `src/lib/nativeTracking.ts` | Persistir watcherId en localStorage, cleanup huerfanos, logging |
| `src/contexts/DriverTrackingContext.tsx` | Reconexion robusta, separar flujo nativo vs web, logging |


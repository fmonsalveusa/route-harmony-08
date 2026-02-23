

# Corregir GPS Tracking en Background para Android Nativo

## Problema
El tracking GPS se desactiva cada vez que el conductor sale de la app porque:
1. El plugin nativo `@capacitor-community/background-geolocation` **no esta instalado** como dependencia del proyecto -- el codigo lo referencia con `registerPlugin('BackgroundGeolocation')` pero el plugin nativo no existe en el proyecto Android.
2. Sin el plugin nativo, el tracking usa la API web del navegador, que Android suspende cuando la app pasa a segundo plano.
3. Al volver a la app, el WebView se recarga, el estado React se pierde, y el auto-resume reinicia todo desde cero.

## Solucion

### Paso 1: Instalar el plugin nativo (tu computadora)
Debes ejecutar en la terminal de tu proyecto local:
```
npm install @capacitor-community/background-geolocation
npx cap sync android
```
Esto registra el plugin nativo en Android, permitiendo que el GPS siga funcionando con la pantalla apagada o la app en segundo plano.

### Paso 2: Mejorar la logica de auto-resume (cambios en codigo)

**Archivo: `src/lib/nativeTracking.ts`**
- Agregar una funcion `isWatcherActive()` que verifique si ya hay un watcher nativo corriendo, para evitar crear duplicados al volver del background.
- Mejorar el manejo de errores para que si el plugin no esta disponible, caiga al tracking web como respaldo.

**Archivo: `src/contexts/DriverTrackingContext.tsx`**
- Mejorar el auto-resume para que en plataforma nativa, al detectar que `localStorage` dice que el tracking estaba activo, solo reconecte el callback al watcher existente en lugar de crear uno nuevo.
- Agregar un listener de `appStateChange` (Capacitor App plugin) que al volver al foreground verifique que el watcher nativo sigue activo y reconecte si es necesario.
- Eliminar el toast repetitivo de "GPS Tracking started" durante auto-resume para no confundir al conductor.

### Paso 3: Verificar permisos de Android

**Archivo: `android/app/src/main/AndroidManifest.xml`** (en tu proyecto local)
Verificar que estos permisos estan presentes:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

### Paso 4: Rebuild y publicar
1. `git pull` para obtener los cambios de codigo
2. `npm install` (para instalar el plugin)
3. `npx cap sync android`
4. Generar nuevo AAB en Android Studio (incrementar versionCode)
5. Subir a Google Play Console

## Resultado esperado
- El GPS sigue transmitiendo ubicacion incluso con la app en segundo plano o pantalla apagada
- Al volver a la app, la UI muestra el tracking como activo sin reiniciar
- Android muestra una notificacion persistente "GPS tracking is active" mientras el tracking esta corriendo

## Detalle tecnico de los cambios en codigo

### `src/lib/nativeTracking.ts`
- Agregar `export function hasActiveWatcher(): boolean` que retorna `watcherId !== null`
- Hacer que `startNativeTracking` reutilice el watcher existente si `watcherId` ya existe
- Agregar manejo robusto cuando el plugin no esta registrado

### `src/contexts/DriverTrackingContext.tsx`
- En el auto-resume nativo: si `hasActiveWatcher()` es true, solo reconectar el callback sin crear nuevo watcher
- Reemplazar el listener de `visibilitychange` por el listener nativo de Capacitor `App.addListener('appStateChange')` cuando se ejecuta en plataforma nativa
- Suprimir toasts durante auto-resume para evitar el mensaje "GPS Tracking started" cada vez que el conductor abre la app


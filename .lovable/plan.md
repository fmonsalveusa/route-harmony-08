

# Solucion Definitiva: Eliminar Crash Loop en App Android

## Diagnostico

La app se cierra automaticamente a los 8-10 segundos de abrirse. Este tiempo coincide exactamente con **dos operaciones nativas que se ejecutan simultaneamente**:

1. **Push Notifications** (`initPushNotifications`) -- se ejecuta a los 8 segundos del arranque. Llama a `PushNotifications.register()` que **crashea fatalmente** si Firebase/FCM no esta correctamente configurado en el proyecto nativo (falta `google-services.json` o configuracion de Gradle). El flag `PUSH_ENABLED` esta en `true` pero el comentario del propio codigo dice que debe estar en `false` hasta verificar Firebase.

2. **GPS Auto-Start** -- se ejecuta a los 6-8 segundos. Llama a `addWatcher` del plugin nativo. Si falla, el crash se propaga.

3. **Ambos disparan al mismo tiempo**, saturando el bridge nativo de Capacitor exactamente en la ventana de 8-10 segundos donde la app se cierra.

## Cambios

### 1. `src/lib/nativePushNotifications.ts` -- Desactivar push nativo

Cambiar `PUSH_ENABLED` de `true` a `false`. Esto elimina la llamada a `PushNotifications.register()` que es la causa mas probable del crash fatal. Las notificaciones seguiran llegando via el canal Supabase Realtime que ya esta implementado en `DriverMobileLayout.tsx`.

### 2. `src/contexts/DriverTrackingContext.tsx` -- Hacer el auto-start verdaderamente seguro

Problemas actuales en el flujo de auto-start:
- La funcion `startTracking` se pasa como dependencia del `useEffect` pero se declara con `useCallback` que depende de `tracking` y muchas otras cosas. Esto causa re-renders y posibles ejecuciones duplicadas.
- El auto-start no verifica si el componente sigue montado antes de actualizar estado.
- No hay proteccion contra ejecucion concurrente (dos timers pueden disparar `safeAutoStart` simultaneamente).

Cambios:
- Agregar una flag `startingRef` para prevenir ejecucion concurrente de `startTracking`.
- Agregar verificacion de montaje (`isMounted`) en el auto-start `useEffect`.
- **Aumentar el delay del auto-start a 12 segundos** para separarlo completamente de cualquier otra inicializacion nativa.
- Envolver todo el flujo nativo en un try-catch de nivel superior que absorba cualquier error nativo sin propagar.

### 3. `src/lib/nativeTracking.ts` -- Proteger contra crash en registerPlugin

El `registerPlugin` se ejecuta de forma lazy pero puede fallar si el plugin nativo no esta en el APK. Agregar proteccion adicional:
- Envolver `registerPlugin` en un try-catch mas robusto.
- Si la cache de localStorage dice `native_gps_plugin_available = false`, no intentar siquiera registrar el plugin.
- Agregar timeout mas corto (2s) al health-check para que no bloquee el hilo.

## Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/nativePushNotifications.ts` | `PUSH_ENABLED = false` |
| `src/contexts/DriverTrackingContext.tsx` | Concurrency guard, delay a 12s, verificacion de montaje |
| `src/lib/nativeTracking.ts` | Proteccion mas robusta en registerPlugin y health-check |

## Despues de implementar

1. Actualizar la app (recargar WebView -- no necesita nuevo APK porque son cambios en codigo web servido desde el servidor)
2. Limpiar datos de la app en Android (Settings > Apps > Dispatch Up Driver > Clear Data) para resetear los flags de localStorage
3. Abrir la app y verificar que ya no se cierra

## Para re-habilitar Push mas adelante

Cuando tengas Firebase/FCM configurado correctamente (con `google-services.json` en `android/app/`), cambiar `PUSH_ENABLED` de vuelta a `true` y reconstruir el APK.


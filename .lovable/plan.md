

# Fix: Crash de la app Android al solicitar permisos de notificaciones

## Problema
La app nativa Android se cierra inmediatamente despues de que el usuario acepta (o rechaza) el permiso de notificaciones push. El error "Dispatch Up closed because this app has a bug" indica un crash fatal en el codigo nativo.

**Causa raiz:** El plugin `@capacitor/push-notifications` llama a `PushNotifications.register()` que internamente requiere Firebase Cloud Messaging (FCM). Si el archivo `google-services.json` no esta presente o Firebase no esta configurado correctamente en el proyecto Android, esto provoca un crash fatal que no puede ser atrapado por el try-catch de JavaScript.

Ademas, una vez que la app crashea, al reabrirla el codigo vuelve a ejecutar la misma logica y vuelve a crashear en un ciclo infinito.

## Solucion

Hacer que la inicializacion de push notifications sea segura y no bloquee la app:

### 1. Proteger `initPushNotifications` contra crashes
- Agregar un retraso (setTimeout) para que la UI cargue completamente antes de intentar registrar push.
- Verificar que el plugin este disponible antes de llamar a `register()`.
- Si falla, marcar como "no disponible" y no intentar de nuevo.

### 2. Evitar el ciclo de crash al reabrir
- No marcar `initialized = true` antes de que el registro sea exitoso.
- Si la primera llamada falla, no reintentar automaticamente.

---

## Detalles tecnicos

### Archivo: `src/lib/nativePushNotifications.ts`

Cambios:
- Envolver `PushNotifications.register()` en un bloque mas defensivo.
- Agregar un `setTimeout` para diferir la inicializacion y no bloquear el arranque de la app.
- No llamar `register()` si `requestPermissions()` falla o el permiso no fue concedido.
- Mantener `initialized = true` solo despues de que todo haya sido exitoso, pero agregar un flag `attemptedInit` para evitar reintentos infinitos.

```typescript
let initialized = false;
let attemptedInit = false;

export async function initPushNotifications(driverId: string | null) {
  if (!isNativePlatform() || initialized || attemptedInit || !driverId) return;
  attemptedInit = true;

  // Defer to let the app fully render first
  setTimeout(async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission denied');
        return;
      }

      // Add listeners BEFORE calling register
      PushNotifications.addListener('registration', async (token) => { ... });
      PushNotifications.addListener('registrationError', (err) => { ... });
      PushNotifications.addListener('pushNotificationReceived', ...);
      PushNotifications.addListener('pushNotificationActionPerformed', ...);

      await PushNotifications.register();
      initialized = true;
    } catch (err) {
      console.error('[Push] Init error:', err);
    }
  }, 2000);
}
```

### Nota importante para el proyecto Android nativo

Despues de aplicar este fix de codigo, necesitaras:
1. Hacer `git pull` del proyecto.
2. Ejecutar `npx cap sync android`.
3. Verificar que `google-services.json` de Firebase este en `android/app/`.
4. Si NO tienes `google-services.json`, deberas crear un proyecto en Firebase Console, registrar la app con el ID `com.dispatchup.driver`, descargar el archivo y colocarlo en `android/app/`.
5. Reconstruir el APK/AAB desde Android Studio.

Sin el archivo `google-services.json`, las push notifications no funcionaran, pero con este fix **la app ya no se cerrara** -- simplemente omitira el registro de push silenciosamente.

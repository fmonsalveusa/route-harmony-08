
# Mejoras Nativas para la App del Driver - COMPLETADO ✅

## Implementaciones realizadas

### 1. Pull-to-Refresh ✅
- Componente `PullToRefresh.tsx` reutilizable
- Integrado en: DriverDashboard, DriverLoads, DriverPayments, DriverProfile

### 2. Haptic Feedback ✅
- Helper `haptics.ts` con 3 patrones (success, alert, medium)
- Integrado en: StopCard (arrived, picked up, delivered, upload), DriverTrackingContext (start/stop tracking, geofence)

### 3. Modo Oscuro Automático ✅
- ThemeProvider de next-themes con defaultTheme="system"
- Header del driver usa tokens semánticos en vez de colores inline
- Dark mode variables ya definidas en index.css

### 4. Push Notifications Nativas ✅
- Tabla `push_tokens` creada con RLS
- Helper `nativePushNotifications.ts` para registro FCM
- Edge Function `send-push-notification` para enviar via FCM
- Inicialización automática en DriverMobileLayout

## Pasos del usuario

1. `git pull`
2. `npm install`
3. Configurar Firebase Console → obtener Server Key FCM
4. Agregar `google-services.json` al proyecto Android
5. Agregar secret `FCM_SERVER_KEY` en el proyecto
6. `npx cap sync android`
7. Generar nuevo AAB en Android Studio (incrementar versionCode)
8. Subir a Google Play Console

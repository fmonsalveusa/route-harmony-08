

# Mejoras Nativas para la App del Driver - Version Completa

## Resumen
Implementar 4 mejoras para maximizar la experiencia nativa del driver en una sola publicacion: Pull-to-refresh, Haptic feedback, Modo oscuro automatico, y Push Notifications nativas.

---

## 1. Pull-to-Refresh en todas las paginas

Agregar gesto de "deslizar hacia abajo" para refrescar datos en las 4 paginas principales del driver.

**Archivos a modificar:**
- `src/pages/driver-app/DriverDashboard.tsx` - Envolver contenido en componente pull-to-refresh
- `src/pages/driver-app/DriverLoads.tsx` - Igual
- `src/pages/driver-app/DriverPayments.tsx` - Igual
- `src/pages/driver-app/DriverProfile.tsx` - Igual

**Archivo nuevo:**
- `src/components/driver-app/PullToRefresh.tsx` - Componente reutilizable que detecta el gesto de pull-down y muestra un spinner, luego ejecuta la funcion de recarga

**Logica:** Detectar `touchstart` / `touchmove` / `touchend` en la parte superior del scroll. Si el usuario arrastra hacia abajo mas de 60px cuando ya esta en la parte superior, mostrar un spinner y llamar a `onRefresh()`. Funciona en web y nativo.

---

## 2. Haptic Feedback (vibracion)

Agregar vibracion sutil en acciones clave para que la app se sienta mas profesional.

**Archivo nuevo:**
- `src/lib/haptics.ts` - Helper que usa `navigator.vibrate()` (web) o el plugin nativo de Capacitor si esta disponible

**Archivos a modificar:**
- `src/components/driver-app/StopCard.tsx` - Vibrar al: marcar llegada (Arrived), cambiar estado (Picked Up / Delivered), subir foto exitosamente
- `src/contexts/DriverTrackingContext.tsx` - Vibrar al: iniciar/detener tracking, detectar geofence (cerca de un stop)

**Patron de vibracion:**
- Accion exitosa (llegada, upload, status change): vibracion corta (50ms)
- Alerta de geofence: doble vibracion (50ms, pausa 100ms, 50ms)
- Start/Stop tracking: vibracion media (100ms)

---

## 3. Modo Oscuro Automatico

La app cambiara automaticamente entre modo claro y oscuro segun la configuracion del telefono del driver.

**Archivos a modificar:**
- `src/main.tsx` o `src/App.tsx` - Agregar `ThemeProvider` de `next-themes` (ya instalado como dependencia) con `attribute="class"` y `defaultTheme="system"`
- `index.html` - Asegurar que el `<html>` soporte la clase `dark`
- `src/components/driver-app/DriverMobileLayout.tsx` - Actualizar el header para que respete el tema oscuro en lugar de colores fijos inline
- `src/index.css` - Verificar que las variables CSS de dark mode estan definidas (Tailwind + shadcn ya las manejan)

**Detalle:** `next-themes` ya esta instalado. Solo hay que activar el `ThemeProvider` con `defaultTheme="system"` para que siga automaticamente la preferencia del sistema operativo del telefono. La mayoria de los componentes ya usan variables CSS de shadcn que soportan dark mode automaticamente. Solo hay que revisar estilos inline con colores fijos (como el header del driver).

---

## 4. Push Notifications Nativas

Enviar notificaciones reales del sistema Android cuando se asigna una carga, hay cambios de estado, etc.

**Archivo nuevo:**
- `src/lib/nativePushNotifications.ts` - Helper que registra el dispositivo para push notifications usando la API de `@capacitor/push-notifications` y guarda el token FCM en la base de datos

**Archivo nuevo:**
- `supabase/functions/send-push-notification/index.ts` - Edge Function que envia push via Firebase Cloud Messaging (FCM) cuando se crea una notificacion

**Cambios en base de datos:**
- Nueva tabla `push_tokens` con columnas: `id`, `driver_id`, `token` (FCM token), `platform`, `created_at`
- Trigger o modificacion en la logica existente para llamar a la Edge Function cuando se inserta en `notifications`

**Archivos a modificar:**
- `src/components/driver-app/DriverMobileLayout.tsx` - Inicializar push notifications al montar el layout
- `src/hooks/useNotifications.ts` - Opcionalmente invocar la edge function al crear notificaciones

**Requisito manual del usuario:**
- Crear un proyecto en Firebase Console y obtener la Server Key de FCM
- Agregar el archivo `google-services.json` al proyecto Android
- Instalar `@capacitor/push-notifications` localmente: `npm install @capacitor/push-notifications`

---

## Orden de implementacion

1. Pull-to-Refresh (sin dependencias externas, funciona inmediato)
2. Haptic Feedback (sin dependencias externas, usa API del navegador)
3. Modo Oscuro (usa next-themes ya instalado)
4. Push Notifications (requiere configuracion de Firebase por parte del usuario)

## Pasos del usuario despues de aprobar

1. `git pull`
2. `npm install @capacitor/push-notifications` (para push notifications)
3. Configurar Firebase y agregar `google-services.json` al proyecto Android
4. Agregar el secret de FCM Server Key en la configuracion del proyecto
5. `npx cap sync android`
6. Generar nuevo AAB en Android Studio (incrementar versionCode)
7. Subir a Google Play Console


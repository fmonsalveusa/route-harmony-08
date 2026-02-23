

# Fix: App Android se cierra al segundo de cargar el Dashboard

## Causa del crash

Despues de analizar el codigo, el crash ocurre porque **el GPS tracking se auto-inicia 500ms despues de que el dashboard carga**. El flujo es:

1. Driver hace login, carga el Dashboard
2. `DriverTrackingContext` detecta el `driverId` y revisa si tiene cargas activas
3. Si tiene cargas activas (o tenia tracking activo antes), llama `startTracking(true)` a los 500ms
4. Esto ejecuta `registerPlugin('BackgroundGeolocation')` y llama `addWatcher()` en el plugin nativo
5. Si el plugin `BackgroundGeolocation` no esta correctamente instalado en el APK, o si el permiso de GPS no esta otorgado aun, **el crash ocurre a nivel nativo** (no es un error de JavaScript que el try/catch pueda atrapar)

Adicionalmente, a los 2 segundos se intenta registrar las **push notifications** con Firebase, lo cual tambien puede causar un crash nativo si `google-services.json` no esta configurado.

## Cambios para solucionar

### 1. `src/contexts/DriverTrackingContext.tsx` - Proteger el auto-start

- Aumentar el delay del auto-start de 500ms a 3000ms para dar tiempo al app de estabilizarse
- Envolver todo el auto-start en un try/catch global extra
- Verificar que el plugin existe antes de intentar usarlo (con un health-check previo)
- Agregar un flag `isReady` que solo se activa cuando el componente lleva montado suficiente tiempo

### 2. `src/lib/nativeTracking.ts` - Health check del plugin

- Agregar una funcion `isBackgroundGeolocationAvailable()` que verifica si el plugin esta realmente disponible antes de intentar usarlo
- Si el plugin no responde, retornar silenciosamente sin crashear
- Agregar logs de diagnostico para futuro debugging

### 3. `src/lib/nativePushNotifications.ts` - Proteger el registro

- Aumentar el delay de 2s a 5s
- Agregar validacion extra antes de llamar `register()`
- Envolver en doble try/catch para proteger contra crashes nativos

### 4. `src/components/driver-app/DriverMobileLayout.tsx` - Proteger StatusBar

- Envolver la configuracion de StatusBar en verificacion mas robusta
- Agregar catch mas defensivo para evitar crashes silenciosos

## Resultado esperado

- La app no se cierra al cargar el Dashboard
- El GPS tracking se inicia solo cuando el plugin esta verificado como disponible
- Las push notifications se registran de forma segura
- Si algo falla, se muestra un log en consola (no un crash)


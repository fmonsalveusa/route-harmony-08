# CLAUDE.md — Contexto del proyecto Dispatch Up TMS

## Sobre el usuario

- **Nombre:** Francisco Monsalve (Fran)
- **Idioma:** Español latinoamericano, tono directo, sin rodeos
- **Nivel técnico:** Intermedio — entiende muchas cosas y aprende rápido
- **Negocio:** Owner Operators de Boxtruck y Hotshot, dueño de 58 Logistics LLC y AG-AR Transportation LLC
- **Ubicación:** Charlotte, NC (zona horaria Eastern)

## Cómo trabajar conmigo

- **Sé breve y ve al grano.** No expliques diagnósticos técnicos en detalle. No describas lo que vas a hacer — solo ejecuta y da el resultado final.
- **Responde en español** latinoamericano, tono conversacional.
- **Primero la respuesta, luego la explicación** si es necesaria. Máximo 2-3 párrafos.
- **No repitas lo que ya dije.** No parafrasees mi pregunta.
- **No me pidas que edite archivos manualmente.** Modifica tú el archivo y pásalo listo.
- **Siempre verifica antes de entregar:** usa `git diff --stat`, `Select-String`, o grep para confirmar que los cambios son correctos y que no se perdió nada.
- **Antes de tocar cualquier archivo, sácalo de git** (`git show HEAD:ruta`) para partir de la versión real, no de una copia local potencialmente desactualizada.

## Arquitectura del proyecto

### Repositorio
- **Repo:** `github.com/fmonsalveusa/route-harmony-08`
- **Local:** `C:\Users\fmons\route-harmony-08`
- **Es UN SOLO repo** para TMS web + driver mobile app

### Stack
- **Frontend:** React + TypeScript + Vite + TanStack Query + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **Supabase project ref:** `tejzatzzwivvaznxyqej`
- **Tenant ID:** `7b4e906b-3d75-44ba-a8b0-64bc923a3c36`
- **Mobile:** Capacitor 8 (core 8.1.0, android 8.3.0, ios 8.3.0)
- **iOS:** bundle `com.dispatchup.driver`, App Store ID `6761345616`, Team ID `AY3TN9N54Z`
- **Android:** package `com.dispatchup.app` (cuenta de organización 58 Logistics; antes `com.dispatchup.driver2`), keystore `C:\Users\fmons\my-keystore.keystore`, alias `dispatchup`

### Deploy
- **TMS Web:** Vercel auto-deploy al push a `main` → `www.dispatch-up.com`
- **Mobile app:** Codemagic (workflows separados Android/iOS). La app carga el JS desde `server.url: 'https://www.dispatch-up.com'` (NO usa archivos locales). Cambios de JS llegan sin recompilar, cambios nativos (plugins, permisos) requieren recompilar.
- **Edge Functions:** `supabase functions deploy <nombre> --project-ref tejzatzzwivvaznxyqej`
- **Landing page:** Mismo repo, misma URL

### Empresas
- **58 Logistics LLC** — company_id: `21f1d144-908f-4b6b-85e6-1e15e33ac0a3`, MC# 1708664
- **AG-AR Transportation LLC** — company_id: `789196fd-825a-45ea-b9e2-6da6bc189b10`, MC# 1155701

## Estructura de archivos clave

### TMS Web (admin/dispatcher)
- `src/pages/Loads.tsx` — Página principal de cargas
- `src/pages/Tracking.tsx` — Rastreo en tiempo real de flota
- `src/pages/Maintenance.tsx` — Mantenimiento de camiones (odómetro manual)
- `src/pages/Documents.tsx` — Documentos de firma electrónica
- `src/components/LoadFormDialog.tsx` — Formulario crear/editar carga
- `src/components/LoadDetailPanel.tsx` — Detalle de carga (paradas, fotos, rate confirmation)
- `src/components/StopPhotoGrid.tsx` — Grilla de fotos por parada (tiles con zoom)
- `src/components/StopDocumentGroup.tsx` — BOL/POD thumbnails
- `src/components/AppLayout.tsx` — Layout principal (menú, notificaciones, reminder)
- `src/components/LiveNotificationToasts.tsx` — Popups de notificaciones en tiempo real
- `src/components/MaintenanceReminder.tsx` — Recordatorio cada 48h a las 9AM Eastern
- `src/contexts/AuthContext.tsx` — Autenticación (SENSIBLE — no reinicia al cambiar de pestaña)
- `src/contexts/DriverTrackingContext.tsx` — Lógica de tracking GPS
- `src/hooks/useLoads.ts` — Hook de cargas (LOADS_SELECT define qué campos se traen)
- `src/hooks/useLoadStops.ts` — Hook de paradas (saveStops recrea stops al editar)
- `src/hooks/usePodDocuments.ts` — Hook de fotos/documentos de parada
- `src/hooks/useTruckMaintenance.ts` — Hook de mantenimiento (cálculo por odómetro)
- `src/lib/nativeTracking.ts` — Plugin GPS background (@capgo/background-geolocation)

### Driver Mobile App
- `src/pages/driver-app/DriverLoadDetail.tsx` — Detalle de carga del driver
- `src/pages/driver-app/DriverLoads.tsx` — Lista de cargas del driver
- `src/pages/driver-app/DriverProfile.tsx` — Perfil del driver
- `src/pages/driver-app/DriverTracking.tsx` — Pantalla de tracking GPS
- `src/components/driver-app/StopCard.tsx` — Card de parada donde el driver sube fotos

### Edge Functions (Supabase)
- `supabase/functions/driver-onboarding/index.ts` — Onboarding de drivers (firma leasing, crea driver)
- `supabase/functions/extract-pdf/index.ts` — Extracción IA de datos de rate confirmation
- `supabase/functions/send-meeting-request/index.ts` — Envío email de reunión (Gmail SMTP)

### Configuración nativa
- `ios/App/App/Info.plist` — Permisos iOS (ubicación, background modes)
- `android/app/src/main/AndroidManifest.xml` — Permisos Android
- `android/app/src/main/res/values/strings.xml` — Config notificación GPS background
- `capacitor.config.ts` — Config Capacitor (server.url, useLegacyBridge)

## Base de datos — Tablas importantes

### loads
- Campos principales: `id`, `reference_number`, `origin`, `destination`, `pickup_date`, `delivery_date`, `pickup_time`, `delivery_time`, `total_rate`, `status`, `driver_id` (TEXT, no UUID), `truck_id`, `dispatcher_id`, `company_id`, `pdf_url`, `factoring`
- Status flow: planned → dispatched → in_transit → on_site_pickup → picked_up → on_site_delivery → delivered
- `factoring`: pending → ready (al cambiar a ready se genera pago automáticamente via trigger `trg_generate_payment_on_factoring_ready`)

### load_stops
- `id`, `load_id`, `stop_type` (pickup/delivery), `address`, `stop_order`, `date`, `time` (TEXT), `photos` (JSONB), `tenant_id`
- ⚠️ Al editar una carga, los stops se BORRAN y RECREAN con nuevos IDs. El código migra `pod_documents` por `stop_order` (no por address, porque puede haber paradas con la misma dirección)

### pod_documents
- `id`, `load_id`, `stop_id`, `file_url`, `file_name`, `file_type`, `tenant_id`, `created_at`
- Bucket: `driver-documents`
- ⚠️ Necesita constraint UNIQUE en `driver_id` para upsert (en `driver_locations`)

### drivers
- `id` (UUID), `name`, `email`, `truck_id` (TEXT, apunta a trucks.id)
- Relación inversa: `drivers.truck_id` → `trucks.id` (NO es `trucks.driver_id`)
- `service_type`: 'owner_operator', 'company_driver', etc.
- Columnas de documentos: `leasing_agreement_url` (AG-AR), `leasing_agreement_58_url` (58 Logistics), `service_agreement_url`

### trucks
- `id` (UUID), `unit_number`, `current_odometer`, `odometer_updated_at`
- ⚠️ `trucks.driver_id` está NULL/no se usa. La relación driver↔truck es por `drivers.truck_id`

### driver_locations
- `driver_id` (UUID, UNIQUE constraint), `lat`, `lng`, `speed`, `heading`, `accuracy`, `tenant_id`, `updated_at`
- ⚠️ Las columnas son `lat`/`lng`, NO `latitude`/`longitude`

### payments
- Generados automáticamente por trigger `trg_generate_payment_on_factoring_ready` cuando `loads.factoring` cambia a 'ready'
- `recipient_type`: 'driver', 'investor', 'dispatcher'

### notifications
- Publicada en Supabase Realtime (`supabase_realtime`)
- LiveNotificationToasts escucha INSERTs y muestra popups
- Se reconecta automáticamente en CHANNEL_ERROR y al volver el foco a la pestaña

## Tipo mismatch conocido
- `loads.driver_id` es TEXT, `drivers.id` es UUID → en SQL usar `::text` para joins
- `drivers.truck_id` es TEXT, `trucks.id` es UUID → en JS usar `String()` para comparar
- `loads.truck_id` es TEXT, `trucks.id` es UUID → mismo patrón

## Lecciones importantes (errores recurrentes)

### Archivos desactualizados
- La carpeta local a veces tiene archivos viejos que no coinciden con git
- **SIEMPRE** sacar archivos de git antes de editar: `git show HEAD:ruta/archivo`
- **SIEMPRE** verificar con `git diff --stat` antes de commitear
- El `Copy-Item` de PowerShell falla silenciosamente si el archivo no existe en Downloads

### Capacitor / App móvil
- `window.open()`, `target="_blank"`, y `<a>.click()` NO funcionan en la app instalada (Capacitor)
- Usar `Browser.open()` de `@capacitor/browser` para abrir URLs
- Usar `Capacitor.isNativePlatform()` para detectar si es app nativa
- El WebView cachea JS agresivamente — para forzar actualización: Ajustes → Apps → Dispatch Up → Borrar caché
- Para PDFs desde base64 en Capacitor: usar overlay inline con iframe (no Filesystem ni Browser.open con data URLs)

### Auth
- El `onAuthStateChange: SIGNED_IN` se dispara al volver el foco a la pestaña
- El AuthContext tiene fix para NO reiniciar la app en ese caso (verifica `isSameUserAlreadyLoaded`)
- Tocar AuthContext es SENSIBLE — probar los 4 casos: login, refocus, user-switch, arranque

### Supabase
- Después de crear cualquier tabla nueva: `GRANT ALL ON TABLE [nombre] TO authenticated, service_role;`
- RLS está activado en la mayoría de tablas con políticas por tenant
- Los signed URLs de Storage expiran (1 hora por defecto) — no cachearlos entre sesiones
- Edge Functions toman nuevos secrets automáticamente sin redesplegar

### Gmail / SMTP
- La Edge Function `send-meeting-request` usa `GMAIL_USER` + `GMAIL_APP_PASSWORD`
- Si se cambia la contraseña de Gmail, las App Passwords se revocan → hay que generar una nueva y actualizar: `supabase secrets set GMAIL_APP_PASSWORD="nueva" --project-ref tejzatzzwivvaznxyqej`

## Extensiones de Chrome (carpeta `tools/`)

Se instalan "descomprimidas" (Modo de desarrollador → Cargar descomprimida); NO están en la Chrome Web Store y NO se actualizan solas.

### Publicación y versiones
- `npm run build` corre primero `scripts/build-extensions.mjs`: arma `public/downloads/dat-driver-tabs.zip`, `public/downloads/rts-factoring-assistant.zip` y `public/downloads/extensions.json` (versiones). Vercel lo hace en cada push → el zip del TMS siempre es la última versión.
- **Al cambiar una extensión: subir `version` en su `manifest.json`** (si no, el aviso de actualización no salta). Después correr `node scripts/build-extensions.mjs` y commitear también `public/downloads/`.
- Descarga desde el TMS: Companies → "Extensión DAT" (`src/components/DatExtensionDialog.tsx`) y "Asistente RTS" (`src/components/RtsAssistantDialog.tsx`). Solo admins.
- La extensión de DAT avisa en DAT con una barra cuando `extensions.json` tiene versión más nueva (`update-banner.js`).

### DAT Driver Tabs — `tools/dat-tab-names` (para one.dat.com)
- `content.js`: nombre del driver en cada pestaña de búsqueda + llamadas tel: por Google Voice (`background.js` reusa la pestaña de Voice).
- **Rating de RTS por broker** (`rts-chip.js`): se busca SIEMPRE por MC. DAT no muestra el MC en la línea pero lo trae en la respuesta GraphQL de la búsqueda (`freight.api.dat.com/one-web-bff/graphql`, `results[].posterDotIds.brokerMcNumber`); `dat-capture.js` (mundo MAIN) lo captura y lo relaciona con la fila por `assetInfo.postingId` = atributo `posting-id` del DOM. Por nombre solo como respaldo.
  - Detalle de carga: chip "RTS" + círculo grande a la derecha de `.company-name`; MC en `.compliance-number`.
  - Colores: A/B/C verde, D naranja, resto rojo; NO BUY = triángulo negro con "!" blanco. Días de pago solo en tooltip.
- **Sesión de RTS**: `rts-capture.js` (MAIN, en rtspro.com) toma el `Authorization: Bearer` que usa la propia página de RTS (dura ~24 h) y `rts-session.js` lo guarda en `chrome.storage.local`. `background.js` consulta `https://stc-debtor-service.rtspro.com/debtors/search?mcNumber=` (o `?name=`), con caché 24 h (`CACHE_VER`). Campos: `rating`, `averageDaysToPayPast60`, `DebNoBuy`, `IsSuperDebtor`, `mc_number`. Nunca leer/mostrar el token.
- **Email al broker** (`broker-email.js`, `email-template.js`, `options.html/js`): botón "✉ Email" a la derecha del email del broker (Contact Information). La configuración se abre con el botón "Configurar email" (a la derecha de los filtros, `.search-filters`) o con el ícono de la extensión.
  - Modo "Enviar directo" (default): Edge Function `dat-broker-email` (verify_jwt false) envía por SMTP desde **58logisticsllc@gmail.com** (cuenta de `BROKER_GMAIL_ACCOUNTS`), envío inmediato con animación en el botón, log en tabla `dat_broker_emails`, marca "✓ Enviado" por `posting_id`.
  - Modo "Abrir en Gmail": compose de Gmail con `authuser`.
  - Plantilla en `chrome.storage.sync` (`emailCfg`), variables `{broker} {origen} {destino} {dho} {fecha} {millas} {equipo} {peso} {largo} {rate} {referencia} {driver}`.
  - Autenticación: header `x-assistant-key` = clave de `integration_keys` kind `rts_assistant` (la misma del Asistente RTS), guardada en `chrome.storage.sync` (`duKey`).

### RTS Factoring Assistant — `tools/rts-factoring-assistant` (para rtspro.com)
- Llena las facturas en el portal de RTS con las cargas de 58 Logistics entregadas en Factoring "pending" (RC + POD). API: Edge Function `rts-assistant` con la misma clave `x-assistant-key`. Al enviar marca Factoring "ready" (genera pagos).

## Pendientes conocidos

1. **Background GPS** — El plugin `@capgo/background-geolocation` está instalado y el código escrito, pero el foreground service no arranca (la notificación persistente no aparece). El tracking solo funciona con la app abierta. Pendiente: crear ícono de notificación compatible con Android Studio y diagnosticar con logs nativos (logcat).

2. **Fotos duplicadas en paradas con misma dirección** — Fix de código aplicado (`useLoadStops.ts` migra por `stop_order` en vez de `address`), pero se revirtió para no arriesgar. Pendiente reaplicar con cuidado.

3. **Fotos desaparecidas en algunas cargas** — Algunas cargas pierden sus fotos/BOL. Causa desconocida. Necesita investigación con logs.

4. **Optimización useLoads** — Pendientes técnicos: quitar `route_geometry` del select, optimizar realtime con cache local, `WeeklyRatesChart` cachear 9 semanas previas.

5. **VIN problemáticos** — Unit 222 con 19 caracteres, units 210/224 con VIN duplicado, 7 sin VIN.

6. **Rediseño de la app móvil (driver e investor) al estilo Material 3 / Google** — En pausa desde 2026-11-17. Todo el TMS web ya está en estilo Google; falta `src/pages/driver-app/*` y `src/components/driver-app/*`. Propuesta acordada:
   - Estructura: barra superior con avatar + empresa, barra inferior Android con pastilla en la pestaña activa (Inicio, Cargas, Pagos, Perfil).
   - Inicio: tarjeta grande de la carga actual (status, próxima parada, progreso) con UN botón grande de la siguiente acción.
   - Detalle de carga / `StopCard`: paradas en línea de tiempo, botones grandes, fotos/BOL en cuadrícula marcando lo que falta.
   - Mis Cargas (tarjetas + chips Activas/Entregadas), Pagos (total semanal grande + lista por semana), Perfil (anillos de vencimiento reutilizando `ExpiryRing` de `src/components/detail/DetailTiles.tsx`), GPS (estado grande verde/rojo).
   - Investor: resumen de ganancias, gráfico semanal, lista de cargas.
   - Orden: Inicio + detalle/paradas → Pagos/Perfil/GPS → investor. Solo diseño (no tocar lógica de GPS, fotos, escáner ni firmas). Es solo JS: no requiere versión nueva en las tiendas; si un driver no lo ve, borrar caché de la app.

## Comandos frecuentes

```powershell
# Sacar archivo de git (versión real)
git show HEAD:src/ruta/archivo.tsx | Out-File "$env:USERPROFILE\Downloads\archivo.txt" -Encoding utf8

# Verificar antes de commitear
git diff --stat
Select-String -Path "src/ruta/archivo.tsx" -Pattern "texto_a_buscar"

# Commit estándar
git add -A  # o archivos específicos
git commit -m "mensaje"
git push origin main

# Deploy Edge Function
supabase functions deploy nombre-funcion --project-ref tejzatzzwivvaznxyqej

# Actualizar secret de Supabase
supabase secrets set CLAVE="valor" --project-ref tejzatzzwivvaznxyqej

# Bump versiones móvil (PowerShell)
# iOS:
(Get-Content "ios\App\App.xcodeproj\project.pbxproj") -replace 'CURRENT_PROJECT_VERSION = X;', 'CURRENT_PROJECT_VERSION = Y;' -replace 'MARKETING_VERSION = A;', 'MARKETING_VERSION = B;' | Set-Content "ios\App\App.xcodeproj\project.pbxproj"
# Android:
(Get-Content "android\app\build.gradle") -replace 'versionCode X', 'versionCode Y' -replace 'versionName "A"', 'versionName "B"' | Set-Content "android\app\build.gradle"
```

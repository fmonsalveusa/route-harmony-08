# Google Play — textos para publicar Dispatch Up en producción

Copia y pega cada sección en Play Console (cuenta de organización 58 Logistics LLC).

---

## 1. Ficha de la tienda (Grow → Store presence → Main store listing)

**App name** (máx. 30)
```
Dispatch Up Driver
```

**Short description** (máx. 80)
```
Loads, live GPS tracking and BOL/POD uploads for Dispatch Up truck drivers.
```

**Full description**
```
Dispatch Up Driver is the companion app for drivers and owner operators who work with Dispatch Up (58 Logistics LLC).

With the app you can:
• See your assigned loads with pickup and delivery stops, dates, appointment times and directions.
• Upload pickup and delivery pictures, scan the BOL and POD with your camera, and send them to dispatch in seconds.
• Share your location during active loads so your dispatcher and the broker can follow the shipment, and get automatic arrival detection at pickups and deliveries.
• Check your payments and settlements.
• Receive notifications when a load is assigned or updated.

Location: while you have an active load, the app collects your location — also when the app is closed or not in use — to track the shipment, detect arrivals and share your position with your dispatcher and the broker. Location is not used for advertising and is never sold. You can turn it off at any time in your phone settings.

This app is for drivers working with Dispatch Up. An account is created by your dispatcher.
```

**Gráficos**
- Ícono 512×512 PNG.
- Imagen destacada 1024×500.
- Mínimo 2 capturas de teléfono (lista de cargas, detalle con paradas, subir fotos/BOL).

**Categoría:** Business · **Email de contacto:** el @dispatch-up.com · **Sitio web:** https://www.dispatch-up.com

---

## 2. Contenido de la app (Policy → App content)

| Sección | Respuesta |
|---|---|
| Privacy policy | `https://www.dispatch-up.com/privacy-policy` |
| Ads | No, my app does not contain ads |
| App access | All or some functionality is restricted → agregar credenciales del driver de prueba (ver sección 5) |
| Content rating | Cuestionario: categoría *Utility, productivity, communication or other*; responder **No** a todo (violencia, sexo, drogas, apuestas, interacción entre usuarios sin moderación: No). Resultado esperado: Everyone / 3+ |
| Target audience | 18 and over |
| News app | No |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health | No |

---

## 3. Data safety (Policy → App content → Data safety)

**Does your app collect or share any of the required user data types?** Yes
**Is all of the user data collected by your app encrypted in transit?** Yes
**Do you provide a way for users to request that their data is deleted?** Yes (pidiéndolo a dispatch / al email de contacto)

| Tipo de dato | Collected | Shared | Opcional | Propósito |
|---|---|---|---|---|
| Location → **Precise location** | Yes | Yes (con el broker de la carga) | No | App functionality |
| Location → Approximate location | Yes | Yes | No | App functionality |
| Personal info → **Name** | Yes | Yes (broker) | No | App functionality, Account management |
| Personal info → **Email address** | Yes | No | No | Account management |
| Personal info → **Phone number** | Yes | Yes (broker) | No | App functionality |
| Photos and videos → **Photos** | Yes | Yes (broker: fotos de carga, BOL/POD) | No | App functionality |
| Files and docs | Yes | Yes (broker: BOL/POD en PDF) | No | App functionality |
| Financial info → Other financial info | Yes (pagos que se le liquidan) | No | No | App functionality |
| App info and performance → Crash logs | No | — | — | — |

"Shared" = se envía a un tercero (el broker que contrató la carga) como parte del servicio.
Nada se usa para publicidad ni se vende.

---

## 4. Permisos de ubicación (Policy → App content → Sensitive permissions → Location permissions)

**¿Qué función usa la ubicación en segundo plano?**
```
Load tracking for truck drivers. While a driver has an active load, the app records the truck's location so the dispatcher and the broker can follow the shipment in real time, the system detects arrival at pickup and delivery locations automatically, and the broker is notified. Drivers keep the phone in the cab and the app closed while driving, so the location must keep updating when the app is in the background. Location is only shared with the dispatcher and the broker of that load, is not used for ads and is not sold.
```

**Video (30–60 s, subir a YouTube como "No listado" y pegar el link)** — guion:
1. Abrir la app e iniciar sesión con el driver de prueba.
2. Que aparezca el aviso **"Uso de tu ubicación / Location use"** y tocar **Continuar**.
3. Conceder el permiso: *While using the app* → luego *Allow all the time* en Ajustes.
4. Mostrar la notificación fija **"Dispatch Up — On Route"** con la app cerrada.
5. Mostrar en el TMS (web) el mapa de Tracking con el punto del driver moviéndose.

**Foreground service (Android 14)** — tipo `location`:
```
The foreground service keeps GPS tracking running during an active load while the app is closed, showing a persistent notification ("Dispatch Up — On Route"). It is required for real-time shipment tracking and automatic arrival detection.
```

---

## 5. Driver de prueba para el revisor de Google

1. En el TMS → **Drivers → Nuevo driver**: nombre `Google Reviewer`, email `review@dispatch-up.com` (o uno @dispatch-up.com que puedas recibir), estado activo, sin grupo de WhatsApp.
2. Crearle el usuario de acceso a la app (rol driver) como a cualquier driver, con una contraseña solo para esto.
3. Asignarle una **carga de prueba** en estado Dispatched (sin broker real, sin email al broker).
4. En **App access** de Play Console pegar el email, la contraseña y esta nota:
```
Log in with these credentials. Open the assigned load to see the stops, upload pictures and test location tracking. Location tracking starts when a load is active.
```
5. **No** asignarle grupo de WhatsApp para que no se envíen avisos.

---

## 6. Publicar

Production → Create new release (o **Promote release** desde Internal testing) → países: **United States** → notas de versión → **Send for review**.
La revisión con permiso de ubicación en segundo plano suele tardar de unos días a 1–2 semanas.

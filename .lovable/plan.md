
# Publicacion de la App Movil en las Tiendas (App Store y Google Play)

Tu proyecto ya tiene Capacitor configurado con los plugins necesarios (Camera, StatusBar, SplashScreen, Filesystem). Ahora necesitas seguir estos pasos para publicar en las tiendas.

## Antes de empezar: Preparar la configuracion

Hay dos cosas que conviene ajustar en la configuracion de Capacitor antes de publicar:

1. **Cambiar el nombre de la app** de `route-harmony-08` a algo como `Load Up Driver`
2. **Cambiar el App ID** a uno personalizado como `com.loadup.driver` (el actual es un ID generico de Lovable)

Estos cambios los puedo hacer aqui en el codigo.

## Pasos que debes hacer en tu computadora

### 1. Exportar el proyecto a GitHub
- Ve a **Settings** en Lovable y conecta tu cuenta de GitHub
- Exporta el proyecto a un repositorio en tu cuenta

### 2. Clonar y preparar el proyecto
```bash
git clone <tu-repositorio>
cd <tu-repositorio>
npm install
```

### 3. Agregar las plataformas nativas
```bash
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### 4. Para iOS (App Store)
- Necesitas una **Mac con Xcode** instalado
- Una cuenta de **Apple Developer Program** ($99/ano) - https://developer.apple.com
- Ejecutar: `npx cap open ios`
- En Xcode:
  - Configura tu Team (cuenta de desarrollador)
  - Ajusta el Bundle Identifier a `com.loadup.driver`
  - Agrega los iconos de la app (AppIcon en Assets)
  - Configura los permisos en Info.plist (ubicacion, camara)
  - Genera un Archive (Product -> Archive) y subelo a App Store Connect

### 5. Para Android (Google Play)
- Necesitas **Android Studio** instalado
- Una cuenta de **Google Play Console** ($25 unico) - https://play.google.com/console
- Ejecutar: `npx cap open android`
- En Android Studio:
  - Agrega los iconos de la app
  - Verifica los permisos en AndroidManifest.xml
  - Genera un AAB firmado (Build -> Generate Signed Bundle)
  - Subelo a Google Play Console

## Permisos nativos importantes

Tu app usa GPS y camara, asi que necesitas declarar estos permisos:

**iOS (Info.plist):**
- `NSLocationWhenInUseUsageDescription` - Para rastreo GPS
- `NSLocationAlwaysUsageDescription` - Para GPS en segundo plano
- `NSCameraUsageDescription` - Para escanear documentos
- `UIBackgroundModes` -> `location`

**Android (AndroidManifest.xml):**
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `CAMERA`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`

## Lo que puedo hacer ahora

Puedo actualizar la configuracion de Capacitor para:
1. Cambiar el nombre de la app a "Load Up Driver"
2. Cambiar el App ID a un identificador profesional (ej: `com.loadup.driver`)

El resto del proceso (compilar, firmar, subir a las tiendas) debe hacerse en tu computadora con Xcode y/o Android Studio.

Para mas detalles, consulta la guia oficial: https://docs.lovable.dev/tips-tricks/native-mobile-apps

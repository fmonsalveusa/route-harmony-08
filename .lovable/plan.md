

# Plan: Preparar y Publicar la App en Google Play Store

Ya que no tienes una Mac, vamos a enfocarnos primero en **publicar en Google Play (Android)**, que puedes hacer desde Windows o cualquier computadora. Para iOS lo veremos despues con una opcion en la nube.

---

## Lo que puedo hacer ahora en el codigo

1. **Verificar que `capacitor.config.ts` este listo** - Ya esta configurado con `com.dispatchup.driver` y nombre "Dispatch Up"
2. **Asegurar que el build de produccion funcione correctamente** - Revisar que no haya errores

## Lo que tu haces en tu computadora (paso a paso)

### Paso 1: Instalar herramientas (solo una vez)

1. **Node.js**: Descarga e instala desde https://nodejs.org (version LTS)
2. **Git**: Descarga e instala desde https://git-scm.com
3. **Android Studio**: Descarga e instala desde https://developer.android.com/studio
   - Durante la instalacion, acepta todo lo que te pida (SDK, licencias, etc.)
4. **Cuenta Google Play Console**: Registrate en https://play.google.com/console ($25 USD, pago unico)

### Paso 2: Descargar el proyecto

Abre la terminal (Command Prompt o PowerShell en Windows) y escribe:

```bash
git clone https://github.com/fmonsalveusa/route-harmony-08.git
cd route-harmony-08
npm install
```

### Paso 3: Preparar la app Android

```bash
npx cap add android
npm run build
npx cap sync
```

### Paso 4: Abrir en Android Studio

```bash
npx cap open android
```

Esto abre Android Studio con tu proyecto. La primera vez puede tardar varios minutos mientras descarga dependencias.

### Paso 5: Generar el archivo para la tienda (AAB)

1. En Android Studio, ve al menu: **Build** -> **Generate Signed Bundle / APK**
2. Selecciona **Android App Bundle** y haz clic en **Next**
3. Haz clic en **Create new...** para crear tu clave de firma:
   - **Key store path**: Haz clic en el icono de carpeta y elige donde guardarlo (ejemplo: `C:\Users\TuNombre\dispatch-up.jks`)
   - **Password**: Pon una contrasena segura (anotala, la necesitaras siempre)
   - **Alias**: escribe `dispatch-up`
   - **Validity**: deja 25 anos
   - Llena nombre, organizacion, ciudad, etc.
   - Haz clic en **OK**
4. Haz clic en **Next**
5. Selecciona **release** y haz clic en **Create**
6. El archivo .aab se genera en `android/app/release/`

**IMPORTANTE**: Guarda el archivo .jks en un lugar seguro. Si lo pierdes, nunca podras actualizar la app.

### Paso 6: Subir a Google Play Console

1. Ve a https://play.google.com/console
2. Haz clic en **Crear aplicacion**
3. Llena los datos:
   - Nombre: "Dispatch Up"
   - Idioma: Espanol o Ingles
   - Tipo: Aplicacion
   - Acceso: Gratuita
4. Ve a **Produccion** -> **Crear nueva version**
5. Sube el archivo .aab que generaste
6. Completa la **Ficha de Play Store**:
   - Descripcion corta (80 caracteres max)
   - Descripcion completa
   - Icono de 512x512 pixeles
   - Grafico de funciones de 1024x500 pixeles
   - Al menos 2 capturas de pantalla de la app
7. Completa el **Cuestionario de contenido** (clasificacion por edad)
8. Selecciona los **Paises** donde quieres publicar
9. Haz clic en **Enviar a revision**

La revision de Google toma entre 1 y 7 dias.

---

## Para iOS (sin Mac): Usar MacinCloud

Cuando estes listo para publicar en App Store:

1. Crea una cuenta en https://www.macincloud.com (desde ~$30/mes)
2. Necesitas tambien una cuenta de Apple Developer Program ($99/ano) en https://developer.apple.com
3. Accedes a una Mac remota desde tu navegador
4. Alli instalas Xcode y sigues los mismos pasos que ya te di para iOS
5. Puedes cancelar MacinCloud una vez que hayas subido la app

---

## Resumen de costos totales

| Concepto | Costo |
|----------|-------|
| Google Play Console | $25 (unico) |
| Apple Developer (cuando lo hagas) | $99/ano |
| MacinCloud (temporal, para iOS) | ~$30/mes |
| Android Studio | Gratis |
| Node.js y Git | Gratis |


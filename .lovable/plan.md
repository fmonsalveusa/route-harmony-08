

# Actualizar el logo de Dispatch Up Driver

## Que se hara

Se reemplazara el logo actual (`src/assets/logo.png`) con la nueva imagen que subiste (la "D" azul/naranja) en todos los lugares donde aparece en la app.

## Donde se usa el logo actualmente

El archivo `src/assets/logo.png` se importa en **7 archivos**:

1. **DriverMobileLayout.tsx** - Header de la app movil (lo que ven los drivers)
2. **AppLayout.tsx** - Sidebar del TMS web (admin/dispatcher)
3. **Auth.tsx** - Pagina de login
4. **DriverOnboarding.tsx** - Formulario de onboarding de drivers
5. **Install.tsx** - Pagina de instalacion PWA
6. **LandingNavbar.tsx** - Navbar del landing page
7. **LandingFooter.tsx** - Footer del landing page

Ademas existe `src/assets/dispatch-up-logo.png` que se usa en los PDFs de facturas de dispatch service.

## Cambios

### 1. Reemplazar `src/assets/logo.png`
- Copiar la imagen subida a `src/assets/logo.png`
- Esto actualizara automaticamente todos los 7 archivos que lo importan, sin necesidad de cambiar codigo

### 2. Reemplazar `src/assets/dispatch-up-logo.png`
- Copiar la misma imagen para que los PDFs de facturas tambien usen el nuevo logo

### 3. Actualizar `public/pwa-icon.png` y `public/favicon.png`
- Copiar la imagen como icono PWA y favicon para que el navegador y la pantalla de inicio muestren el nuevo logo

## Nota importante
- Los cambios web (header, login, landing) se veran automaticamente al hacer Update sin necesidad de nuevo APK
- Para que el **icono de la app en el telefono** cambie, si necesitaras compilar un nuevo APK con los iconos nativos actualizados en `android/app/src/main/res/`




## Problema

La app nativa de Android abre la **Landing Page** (sitio web comercial) en lugar de la pantalla de login de la app del driver. Esto ocurre porque:

1. `capacitor.config.ts` carga la URL raiz `/`
2. Si el usuario no esta autenticado, la ruta `/` muestra `<Landing />` (pagina web)
3. No hay forma de distinguir si la app se abre desde el navegador o desde Capacitor

## Solucion

Detectar cuando la app se ejecuta dentro de Capacitor (nativa) y redirigir automaticamente a `/auth` en lugar de mostrar la Landing Page.

### Cambios necesarios

**1. Modificar `src/App.tsx` (ruta raiz `/`)**

Cambiar la logica de la ruta `/` para que:
- Si el usuario esta autenticado: redirigir segun su rol (sin cambios)
- Si NO esta autenticado Y esta en Capacitor nativo: redirigir a `/auth`
- Si NO esta autenticado Y esta en el navegador: mostrar Landing Page

Se usara `isNativePlatform()` de `@/lib/nativeTracking` (que ya existe en el proyecto) para detectar si estamos en Capacitor.

```text
Linea 122 actual:
  <Route path="/" element={user ? <Navigate to={getRedirectPath()} replace /> : <Landing />} />

Cambia a:
  <Route path="/" element={
    user
      ? <Navigate to={getRedirectPath()} replace />
      : isNativePlatform()
        ? <Navigate to="/auth" replace />
        : <Landing />
  } />
```

### Resultado

- **En el navegador web**: funciona igual que antes (muestra la Landing Page)
- **En la app nativa de Android**: salta directo a la pantalla de login (`/auth`)
- Una vez autenticado como driver, redirige a `/driver` automaticamente (esto ya funciona)

### Despues de aprobar

Tendras que:
1. Hacer git pull en tu computadora
2. Correr `npx cap sync android`
3. Generar un nuevo AAB en Android Studio
4. Subir el nuevo AAB a Google Play Console como una nueva version




# Configurar loaduptms.com como Landing Page + App TMS

## Situacion Actual

- El dominio `www.loaduptms.com` ya existe y apunta a la app
- La landing page esta en `/landing`
- La app TMS esta en `/` (requiere login)
- La app de drivers esta en `/driver`

## Estrategia

Reorganizar las rutas para que la raiz (`/`) muestre la landing page publica y mover el dashboard a `/dashboard`. Asi, cuando alguien visite `loaduptms.com` vera la pagina web profesional, y los usuarios logueados iran directo al dashboard.

### Resultado Final

| URL | Contenido |
|-----|-----------|
| `loaduptms.com` | Landing Page publica |
| `loaduptms.com/auth` | Pagina de Login |
| `loaduptms.com/dashboard` | Dashboard TMS (protegido) |
| `loaduptms.com/loads`, `/fleet`, etc. | Secciones de la app (protegidas) |
| `loaduptms.com/driver` | App de conductores |

## Cambios a Realizar

### 1. Archivo `src/App.tsx`
- Cambiar la ruta `/` para mostrar la Landing Page (publica, sin login)
- Crear nueva ruta `/dashboard` para el Dashboard protegido
- Eliminar la ruta `/landing` (ya no sera necesaria)
- Actualizar `getRedirectPath()` para que redirija a `/dashboard` en vez de `/`
- Usuarios autenticados que visiten `/` seran redirigidos a `/dashboard`

### 2. Archivo `src/components/AppLayout.tsx`
- Cambiar la ruta del Dashboard en el menu lateral de `/` a `/dashboard`

### 3. Archivo `src/components/landing/LandingNavbar.tsx`
- Agregar boton "Iniciar Sesion" que lleve a `/auth`
- Cambiar el enlace del logo para que apunte a `/` en vez de `#`

### 4. Conectar el Dominio en Lovable
Despues de publicar los cambios de rutas:

1. Ir a **Project Settings** (icono de engranaje) > **Domains**
2. Click en **Connect Domain**
3. Agregar `loaduptms.com` y `www.loaduptms.com`
4. Configurar en tu proveedor de dominio (GoDaddy, Namecheap, etc.):
   - **Registro A** para `@` (raiz) apuntando a `185.158.133.1`
   - **Registro A** para `www` apuntando a `185.158.133.1`
   - **Registro TXT** `_lovable` con el valor que Lovable te indique
5. Elegir uno como **Primary** (el otro redirigira automaticamente)
6. Esperar propagacion DNS (hasta 72 horas)
7. SSL se genera automaticamente

**Nota**: Si el dominio actualmente apunta a otro servicio, deberas actualizar los registros DNS existentes para que apunten a Lovable (`185.158.133.1`).


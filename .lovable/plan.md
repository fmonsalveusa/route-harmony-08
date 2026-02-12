
# Fix: Landing Page y boton "Go to App" para Master Admin

## Problema

1. Al visitar `loaduptms.com` estando logueado como Master Admin, la ruta `/` redirige automaticamente a `/master` (linea 104 de App.tsx), por lo que nunca se ve la landing page.
2. El boton "Go to App" en el sidebar apunta a `/` (linea 146 de AppLayout.tsx), pero como `/` redirige a `/master`, el boton no hace nada visible.

## Solucion

### 1. AppLayout.tsx - Corregir el enlace "Go to App"
- Cambiar el destino del boton "Go to App" de `/` a `/dashboard`
- Asi el Master Admin navega directamente al Dashboard operativo del TMS

### 2. App.tsx - Sin cambios necesarios
- El comportamiento actual de la ruta `/` es correcto: usuarios autenticados van a su dashboard correspondiente, usuarios no autenticados ven la landing page
- La landing page publica se muestra correctamente para visitantes no logueados

## Detalle Tecnico

Archivo `src/components/AppLayout.tsx`, linea 146:

Cambiar:
```
to={isMasterRoute ? '/' : '/master'}
```
Por:
```
to={isMasterRoute ? '/dashboard' : '/master'}
```

Esto resuelve ambos problemas porque:
- "Go to App" ahora lleva al `/dashboard` (la app operativa)
- La landing page en `/` sigue siendo publica para visitantes sin login
- Los usuarios autenticados que visiten `/` directamente seguiran siendo redirigidos a su panel correspondiente

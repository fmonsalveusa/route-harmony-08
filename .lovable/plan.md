

## Layout móvil optimizado para administrador

### Problema
Cuando un admin usa la app desde el teléfono, ve el dashboard web completo con menú hamburguesa. La experiencia no es nativa — no hay barra de navegación inferior como la de los drivers.

### Solución
Agregar una barra de navegación inferior (bottom tab bar) en `AppLayout` que aparezca solo en pantallas móviles (`< 768px`), con las 5 secciones más usadas por el admin. El menú hamburguesa seguirá disponible para acceder a todas las demás páginas.

### Cambios

**`src/components/AppLayout.tsx`**
1. Importar `useIsMobile` desde `@/hooks/use-mobile`
2. Agregar una barra de tabs inferior visible solo en móvil (`lg:hidden`) con 5 tabs principales:
   - Dashboard (`/dashboard`)
   - Loads (`/loads`)
   - Fleet (`/fleet`)
   - Payments (`/payments`)
   - More (abre el menú hamburguesa existente)
3. Para rutas master, los tabs serán: Dashboard (`/master`), Companies (`/master/tenants`), Stats (`/master/stats`), Billing (`/master/billing`), Settings (`/master/settings`)
4. Agregar `pb-[72px] lg:pb-0` al `<main>` para dejar espacio al bottom bar en móvil
5. Estilo similar al `DriverMobileLayout`: barra fija abajo, iconos + labels, indicador naranja activo, `safe-area-pb`

### Detalle técnico
- La barra solo se renderiza en `< lg` (móvil/tablet)
- El botón "More" reutiliza `setMobileMenuOpen(true)` para abrir el overlay existente
- No se modifica ninguna otra página — solo `AppLayout`
- Los tabs se filtran por permisos igual que la nav actual


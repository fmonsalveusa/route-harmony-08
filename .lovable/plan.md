

# Rediseño de Layout: Navegacion Superior estilo Chase Business

## Concepto
Transformar el layout actual (sidebar lateral izquierdo) a un layout con navegacion horizontal superior, inspirado en Chase Business:

```text
┌─────────────────────────────────────────────────────┐
│  LOGO  Dispatch Up          🔔 ROLE  User  [LogOut] │  ← Header azul oscuro, texto blanco
├─────────────────────────────────────────────────────┤
│  Dashboard  Loads  Fleet  Drivers  Payments  ...    │  ← Nav bar: fondo blanco, texto azul
├─────────────────────────────────────────────────────┤
│                                                     │
│   Fondo gris mas oscuro (~#e8ebef)                  │
│                                                     │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │ Card     │ │ Card     │ │ Card     │  ← Cards  │
│   │ blanca   │ │ blanca   │ │ blanca   │    blancas │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Cambios Principales

### 1. `src/index.css` - Ajustar colores base
- **Background** mas oscuro: cambiar `--background` de `215 25% 97%` (~#f2f4f7) a `215 20% 90%` (~#dee3ea) para mayor contraste con cards blancas
- **Card** se mantiene blanco puro `0 0% 100%`
- Agregar nuevas clases CSS para el top-nav

### 2. `src/components/AppLayout.tsx` - Restructuracion completa del layout
**Eliminar sidebar lateral** y reemplazar con:

- **Header superior** (fila 1): Fondo azul oscuro (`bg-[hsl(214,52%,25%)]`), logo + nombre "Dispatch Up" a la izquierda, acciones del usuario a la derecha (ThemeToggle, NotificationBell, role badge, avatar, logout) - todo en texto blanco
- **Barra de navegacion** (fila 2): Fondo blanco, botones de navegacion con texto azul, item activo con borde inferior azul (como la pestaña "Accounts" en Chase)
- **Contenido**: Se mantiene igual pero con el fondo mas oscuro

**Mobile**: El menu hamburguesa abrira un dropdown/sheet con los nav items en vez del sidebar lateral

### 3. `src/components/StatCard.tsx` - Asegurar cards blancas
- Mantener `glass-card` o cambiar a fondo blanco solido para maximo contraste contra el fondo gris

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/index.css` | `--background` mas oscuro, nuevas clases `.top-nav`, `.top-nav-item`, `.top-nav-item-active` |
| `src/components/AppLayout.tsx` | Eliminar sidebar, crear header azul + nav bar blanca horizontal |

## Detalles tecnicos

- El sidebar se elimina completamente (no coexiste con el top nav)
- Los nav items se renderizan horizontalmente con overflow scroll en mobile
- El item activo lleva un `border-bottom: 3px solid` azul, similar a Chase
- El header azul usa el color `--primary` existente (`214 52% 25%`) que ya es un azul oscuro
- En mobile: hamburger menu abre un Sheet/dropdown con los items verticales
- El widget de plan/subscription del sidebar se omite del top nav (se puede mover a un dropdown del avatar)
- El boton "Master Panel" / "Go to App" para master_admin se coloca en el header
- Compatible con dark mode: el header mantiene azul oscuro, la nav bar se adapta


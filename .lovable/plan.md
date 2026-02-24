

# Mejora Visual Completa: Glassmorphism en toda la App

Este es un plan grande que cubre las 4 areas solicitadas. Recomiendo implementarlo en fases para mantener la estabilidad. Aqui va la fase completa:

## Fase 1: Sidebar y Header con Glassmorphism

### `src/components/AppLayout.tsx`
- **Sidebar**: Cambiar fondo solido por gradiente sutil con backdrop-blur. Agregar borde interior translucido.
- **Header**: Agregar `backdrop-blur-xl` y fondo semitransparente en lugar de `bg-card` solido.
- **Nav items activos**: Agregar borde izquierdo de acento (2px) en el item activo + fondo glass sutil.
- **Logo area**: Separador inferior con gradiente en lugar de borde solido.
- **Hover en nav**: Transicion suave con efecto de brillo sutil.
- **Collapse button**: Estilo glass con hover.

### CSS nuevos en `src/index.css`
- `.glass-sidebar` -- sidebar con gradiente + blur
- `.glass-header` -- header translucido con blur
- `.nav-item-active` -- borde izquierdo de acento + fondo glass

## Fase 2: Dashboard y Graficas

### `src/components/dashboard/RatesByDriverChart.tsx`
- Envolver en `glass-card` en lugar de `Card` plano
- Agregar gradiente sutil al fondo de las barras
- Labels de valores con mejor contraste (adaptacion dark/light)
- Bordes redondeados en las barras (`radius` prop)

### `src/components/dashboard/WeeklyRatesChart.tsx`
- `glass-card` como contenedor
- Area con gradiente translucido
- Grid lines mas sutiles (opacidad reducida)
- Tooltip con efecto glass

### `src/components/dashboard/DispatcherCommissionsChart.tsx`
- Mismo tratamiento glass-card
- Barras con bordes redondeados

### `src/components/dashboard/MarketAnalysisCard.tsx`
- Glass-card como contenedor

### `src/components/dashboard/DashboardFilters.tsx`
- Barra de filtros con fondo glass sutil y borde translucido

## Fase 3: Formularios y Dialogs

### `src/components/ui/dialog.tsx`
- Overlay con mayor blur (de default a `backdrop-blur-md`)
- Dialog content con efecto glass: fondo semitransparente, borde sutil
- Sombra difusa mas pronunciada

### `src/components/ui/input.tsx`
- Focus ring con glow sutil del color de accent
- Bordes con transicion mas suave

### `src/components/ui/select.tsx`
- Dropdown con efecto glass en el contenido desplegable

## Fase 4: Paginas Restantes (Fleet, Payments, Expenses, Dispatchers, Invoices, Companies, Users)

### `src/pages/Fleet.tsx`
- Tabla envuelta en `glass-card`
- Header con `glass-table-header`
- Filas con `glass-row`
- Botones de accion con `glass-action-btn` + tints semanticos

### `src/pages/Payments.tsx`
- Misma transformacion: `glass-card`, `glass-table-header`, `glass-row`
- Botones de receipt/edit/delete con glass-action-btn
- Stat cards ya usan glass (no requieren cambio)

### `src/pages/Expenses.tsx`
- Tabla con glass-card y glass-row
- Botones con glass-action-btn

### `src/pages/Dispatchers.tsx`
- Cards de dispatchers con `glass-card` en lugar de `Card`
- Botones con glass-action-btn

### `src/pages/Invoices.tsx`
- Tabla con glass-card, glass-table-header, glass-row
- Botones de accion con glass-action-btn

### `src/pages/Companies.tsx`
- Aplicar glass-card a las tarjetas/tabla

### `src/pages/UsersPage.tsx`
- Aplicar glass-card y glass-row

### `src/pages/Maintenance.tsx`
- Cards de mantenimiento ya usan animacion; agregar glass-card

### `src/pages/Performance.tsx`
- Cards y graficas con glass-card

## Archivos a modificar (resumen)

| Archivo | Cambio principal |
|---|---|
| `src/index.css` | Clases `.glass-sidebar`, `.glass-header`, `.nav-item-active`, mejoras a dialog glass |
| `src/components/AppLayout.tsx` | Sidebar y header con glass + nav items mejorados |
| `src/components/ui/dialog.tsx` | Overlay con blur + content con glass |
| `src/components/dashboard/RatesByDriverChart.tsx` | glass-card + barras redondeadas |
| `src/components/dashboard/WeeklyRatesChart.tsx` | glass-card + area con gradiente |
| `src/components/dashboard/DispatcherCommissionsChart.tsx` | glass-card |
| `src/components/dashboard/MarketAnalysisCard.tsx` | glass-card |
| `src/components/dashboard/DashboardFilters.tsx` | Fondo glass en barra de filtros |
| `src/pages/Fleet.tsx` | glass-card, glass-table-header, glass-row, glass-action-btn |
| `src/pages/Payments.tsx` | glass-card, glass-table-header, glass-row, glass-action-btn |
| `src/pages/Expenses.tsx` | glass-card, glass-row, glass-action-btn |
| `src/pages/Dispatchers.tsx` | glass-card en dispatcher cards |
| `src/pages/Invoices.tsx` | glass-card, glass-table-header, glass-row, glass-action-btn |
| `src/pages/Companies.tsx` | glass-card |
| `src/pages/UsersPage.tsx` | glass-card, glass-row |
| `src/pages/Maintenance.tsx` | glass-card en maintenance cards |
| `src/pages/Performance.tsx` | glass-card |

## Detalles tecnicos

- Todo con CSS puro + Tailwind, sin nuevas dependencias
- Reutiliza las clases `.glass-*` ya definidas en index.css; solo se agregan 3 nuevas (sidebar, header, nav-item)
- Compatible con dark mode automaticamente
- Los charts de Recharts se envuelven en divs glass en lugar de modificar los componentes de Recharts directamente
- Los dialogs se mejoran sin romper la API existente de Radix




# Mejora Visual: Glassmorphism Moderno en Tablas y Listas

## Diagnostico actual

Las tablas de Loads, Drivers, Fleet, Payments, etc. usan un estilo funcional pero basico: `Card` con borde solido, header `bg-muted/50`, filas planas con `hover:bg-muted/30`, y botones de accion con colores inline hardcodeados (border-sky-400, border-emerald-400, etc.). No hay profundidad visual ni efecto de cristal.

## Cambios propuestos

### 1. CSS global -- nuevas utilidades glassmorphism (`src/index.css`)

Agregar clases reutilizables al layer `@components`:

- `.glass-card` -- fondo semitransparente con backdrop-blur, borde sutil blanco/oscuro, sombra difusa
- `.glass-table-header` -- header de tabla con efecto de cristal y texto mas definido
- `.glass-row` -- filas con hover translucido y transicion suave
- `.glass-row-expanded` -- fila expandida con fondo cristal mas marcado
- `.glass-action-btn` -- botones de accion con efecto vidrio (reemplaza los colores hardcodeados)
- Variantes para dark mode automaticas

Ejemplo visual del efecto:
```text
┌─────────────────────────────────────────────────┐
│  ░░░░ backdrop-blur ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Load #   Driver    Origin    Status   Rate  │ │  ← header cristal
│  ├─────────────────────────────────────────────┤ │
│  │ L-001    John S.   Dallas    ●Active  $2.4k │ │  ← fila con hover cristal
│  │ L-002    Maria L.  Houston   ●Transit $1.8k │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2. Tablas de Loads (`src/pages/Loads.tsx`)

- Cambiar el `<Card>` que envuelve la tabla por la clase `glass-card`
- Header de tabla (`<thead>`) usa `glass-table-header` en lugar de `bg-muted/50`
- Filas (`<tr>`) usan `glass-row` con hover con efecto de brillo sutil
- Fila expandida usa `glass-row-expanded`
- Botones de accion (Edit, Delete, POD, Invoice) reemplazar los colores hardcodeados por `glass-action-btn` con variantes semanticas
- Tabs de filtro (Active/Delivered/Cancelled/All) con efecto cristal en el tab activo
- Barra de filtros con fondo glass sutil

### 3. Tabla de Drivers (`src/pages/Drivers.tsx`)

- Mismos cambios que Loads: `glass-card`, `glass-table-header`, `glass-row`
- Botones Copy/Detail/Edit/Delete con `glass-action-btn` en lugar de colores hardcodeados
- Badge de "pending" con efecto glow sutil
- Tabs Active/Inactive/All con estilo glass

### 4. StatCard upgrade (`src/components/StatCard.tsx`)

- Agregar efecto glassmorphism al contenedor: backdrop-blur, borde translucido
- Icono con fondo glass en lugar de color solido plano
- Hover con brillo sutil que se desplaza

### 5. StatusBadge upgrade (`src/components/StatusBadge.tsx`)

- Agregar backdrop-blur sutil a los badges de status
- Borde translucido blanco para efecto "flotante"
- Sombra glow sutil del color del status

### 6. Card base (`src/components/ui/card.tsx`)

- No modificar el componente base para no romper nada existente
- En su lugar, todas las mejoras van en las clases CSS utilitarias nuevas que se aplican encima

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/index.css` | Nuevas clases `.glass-*` con soporte light/dark |
| `src/pages/Loads.tsx` | Aplicar clases glass a tabla, header, filas, botones, tabs |
| `src/pages/Drivers.tsx` | Aplicar clases glass a tabla, header, filas, botones |
| `src/components/StatCard.tsx` | Efecto glassmorphism en card e icono |
| `src/components/StatusBadge.tsx` | Backdrop-blur y glow sutil en badges |

## Detalles tecnicos

- Todo se logra con CSS puro (Tailwind + `@apply` + propiedades CSS como `backdrop-filter`, `box-shadow`, `border-color` con alpha)
- No se agregan dependencias
- Dark mode automatico usando el selector `.dark` ya existente
- Las clases son aditivas: se aplican encima de los componentes existentes sin romper funcionalidad
- Los colores de los botones de accion se simplifican a variantes glass con tinte semantico (verde para positivo, rojo para destructivo, azul para info)


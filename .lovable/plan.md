

## Asociar Cargas con Empresas

### Problema
Actualmente las cargas no tienen un campo que indique con cuál de las empresas registradas se tomó la carga. La contadora necesita ver esta información claramente al abrir el detalle.

### Solución

**1. Base de datos** — Agregar columna `company_id` a la tabla `loads`
```sql
ALTER TABLE loads ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
```

**2. Formulario de carga (`LoadFormDialog.tsx`)**
- Agregar un selector de empresa (dropdown) usando las companies del hook `useCompanies`
- Guardar el `company_id` seleccionado al crear/editar la carga

**3. Detalle de carga (`LoadDetailPanel.tsx`)**
- Mostrar un badge/banner prominente con el logo (si existe) y nombre de la empresa asociada, justo arriba de la información del load
- Estilo: un bloque visual con icono de `Building2`, nombre de la empresa en bold, y MC/DOT number como subtexto — fondo con color sutil para que destaque sin ser invasivo

**4. Hook `useLoads.ts`**
- Incluir `company_id` en el select query y en las interfaces `DbLoad` y `CreateLoadInput`

**5. Tabla de cargas (`Loads.tsx`)**
- Opcionalmente mostrar el nombre de la empresa en una columna o como badge en la fila

### Diseño visual del badge en el detalle

```text
┌─────────────────────────────────────────┐
│ 🏢  DISPATCH UP LLC                     │
│      MC# 123456  •  DOT# 789012        │
└─────────────────────────────────────────┘
```

Un bloque con borde izquierdo de color primary, fondo `bg-primary/5`, icono `Building2`, nombre en negrita y datos de la empresa en texto pequeño.

### Archivos a modificar
- **Migración SQL**: agregar `company_id` a `loads`
- `src/hooks/useLoads.ts`: agregar `company_id` a interfaces y query
- `src/components/LoadFormDialog.tsx`: agregar selector de empresa
- `src/components/LoadDetailPanel.tsx`: mostrar empresa asociada con diseño profesional
- `src/pages/Loads.tsx`: mostrar nombre de empresa en la tabla (opcional)


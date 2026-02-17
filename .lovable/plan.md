

# Rediseno del dialogo "Add Maintenance" al estilo del dialogo "Add Expense"

## Objetivo
Reorganizar el formulario de MaintenanceFormDialog para que tenga el mismo estilo visual y estructura por secciones del ExpenseFormDialog, manteniendo toda la informacion tecnica de mantenimiento (intervalos de millas/dias, odometro, tipo de mantenimiento, etc.).

## Cambios en el archivo
**Archivo a modificar:** `src/components/maintenance/MaintenanceFormDialog.tsx`

## Nueva estructura del dialogo

### Seccion 1: Basic Information (Informacion Basica)
- **Date Performed** (date input, max = hoy)
- **Truck** (select con unit_number + make/model, mostrando driver asignado)
- **Assigned Driver** (badge automatico como en Expenses, company_driver vs owner_operator)

### Seccion 2: Maintenance Details (Detalles del Mantenimiento)
- **Maintenance Type** (select con los tipos predefinidos + custom)
- **Custom Type Name** (condicional, solo si type = custom)
- **Odometer Reading (miles)** (input numerico)
- **Description/Notes** (textarea con contador de caracteres)

### Seccion 3: Schedule Intervals (Programacion)
- **Interval (miles)** (input numerico, auto-llenado segun tipo)
- **Interval (days)** (input numerico, auto-llenado segun tipo)

### Seccion 4: Cost Information (Informacion de Costo)
- **Amount** (input con prefijo $, igual que Expenses)
- **Vendor** (input texto)
- **Create expense record** (switch toggle, visible solo si cost > 0 y no es edicion)

### Footer
- Boton "Cancel" (outline) + Boton "Create Schedule" / "Update" (primary)

## Detalles tecnicos

- Cambiar `max-w-lg` a `max-w-2xl` para coincidir con el ancho del dialogo de Expenses
- Agregar los headers de seccion con clase `text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider`
- Usar grid `md:grid-cols-2` para los campos, igual que en Expenses
- Agregar prefijo `$` al campo de costo como en Expenses
- Necesita recibir `drivers` como prop adicional para mostrar el driver asignado al truck seleccionado
- El componente padre `Maintenance.tsx` ya importa trucks via `useTrucks()`, se agregara tambien `useDrivers()` para pasar los drivers al dialogo
- Agregar footer con botones Cancel + Save separados (en lugar del boton unico full-width actual)

## Archivos a modificar
1. **`src/components/maintenance/MaintenanceFormDialog.tsx`** -- Rediseno completo del layout
2. **`src/pages/Maintenance.tsx`** -- Agregar `useDrivers()` y pasar `drivers` como prop al dialogo

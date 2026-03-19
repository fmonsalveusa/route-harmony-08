

## Separar Mantenimientos One-Time en Tabla Compacta

### Resumen
Dentro de cada grupo por camión, los mantenimientos **recurrentes** seguirán mostrándose como cards (como ahora). Los **one-time** se mostrarán en una tabla compacta debajo, con columnas: Tipo, Fecha, Odómetro, Costo, Vendor, y acciones (editar/eliminar).

### Cambios

#### 1. `src/pages/Maintenance.tsx`
- Dentro del loop por camión, separar `items` en dos arrays: `recurringItems` (tienen `interval_miles` o `interval_days`) y `oneTimeItems` (no tienen ninguno).
- Renderizar `recurringItems` con `MaintenanceCard` en grid como ahora.
- Renderizar `oneTimeItems` en una tabla debajo del grid, con header "One-Time Services".

#### 2. Nuevo componente: `src/components/maintenance/OneTimeMaintenanceTable.tsx`
- Recibe `items: DbTruckMaintenance[]`, `onEdit`, `onDelete`.
- Renderiza una tabla con columnas: Type (icon + label), Date (last_performed_at), Odometer (last_miles), Cost, Vendor (de description o "—"), y columna Actions con botones icon-only de Edit y Delete.
- Filas compactas, estilo consistente con el resto de la app (usa componentes `Table` de shadcn).
- Si no hay items one-time, no renderiza nada.

#### 3. `src/components/maintenance/MaintenanceCard.tsx`
- Sin cambios. Solo se usará para recurrentes.

### Archivos
| Archivo | Acción |
|---|---|
| `src/components/maintenance/OneTimeMaintenanceTable.tsx` | Crear |
| `src/pages/Maintenance.tsx` | Editar (separar recurring vs one-time) |




## Agregar pestaña "All Services" a la página de Maintenance

### Resumen
Agregar un sistema de pestañas (Tabs) a la página de Maintenance con dos vistas:
- **By Truck** (vista actual): cards agrupadas por camión con recurring cards + tabla one-time.
- **All Services**: una tabla única con TODOS los mantenimientos de todos los camiones, ordenados por fecha, mostrando el camión al que pertenecen.

### Cambios

#### 1. `src/pages/Maintenance.tsx`
- Envolver el contenido actual (filtros + grouped cards) dentro de un `Tabs` con dos `TabsContent`:
  - `by-truck`: contenido actual sin cambios.
  - `all-services`: nueva tabla plana con todos los items filtrados.
- Los summary cards y el header quedan fuera de los tabs (visibles siempre).
- Los filtros de truck/status aplican a ambas pestañas.

#### 2. Tabla "All Services" (inline en Maintenance.tsx o componente separado)
- Columnas: **Date**, **Truck** (unit_number), **Type** (icon + label), **Description**, **Recurring?** (badge Yes/No), **Odometer**, **Miles Accumulated**, **Status** (badge color), **Cost**, **Vendor**, **Actions** (edit/delete/log service).
- Ordenada por `last_performed_at` descendente.
- Reutiliza `getMaintenanceTypeConfig` para iconos y labels.

### Archivos
| Archivo | Acción |
|---|---|
| `src/pages/Maintenance.tsx` | Editar: agregar Tabs wrapper y nueva tabla "All Services" |


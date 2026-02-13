

## Plan: Pestana "Dispatch Service" en Facturacion

### Resumen
Se crearan dos cambios principales:
1. **Nuevo campo en el perfil del Driver**: Un campo `dispatch_service_percentage` que se muestra solo cuando el `service_type` es `dispatch_service`, para definir el porcentaje que la empresa cobra por el servicio de despacho.
2. **Nueva pestana "Dispatch Service"** en la pagina de Invoices con funcionalidad completa para generar facturas a drivers de tipo Dispatch Service.
3. **Nueva tabla** `dispatch_service_invoices` para almacenar estas facturas independientemente de las facturas a brokers.

---

### Paso 1: Migracion de base de datos

**Tabla `drivers`** - Agregar columna:
- `dispatch_service_percentage` (numeric, default 0) - Porcentaje que la empresa cobra al driver por el servicio de despacho.

**Nueva tabla `dispatch_service_invoices`**:
- `id` (uuid, PK)
- `driver_id` (text, referencia al driver)
- `driver_name` (text)
- `invoice_number` (text, formato DSI-0001 auto-incrementable)
- `loads` (jsonb, array con los IDs y detalles de las cargas incluidas)
- `total_amount` (numeric, monto total calculado)
- `percentage_applied` (numeric, porcentaje aplicado)
- `status` (text: pending/sent/paid, default 'pending')
- `notes` (text, nullable)
- `period_from` (date, nullable)
- `period_to` (date, nullable)
- `tenant_id` (uuid, nullable)
- `created_at` / `updated_at` (timestamptz)
- Politicas RLS correspondientes

---

### Paso 2: Actualizar formulario de Driver

**Archivo: `src/components/DriverFormDialog.tsx`**
- Agregar campo `dispatch_service_percentage` que se muestre condicionalmente solo cuando `service_type === 'dispatch_service'`.
- Ubicarlo debajo del selector de Service Type con un estilo similar (borde y fondo naranja para diferenciarlo).

**Archivo: `src/hooks/useDrivers.ts`**
- Agregar `dispatch_service_percentage` a las interfaces `DbDriver` y `DriverInput`.

---

### Paso 3: Nueva pestana en Invoices

**Archivo: `src/pages/Invoices.tsx`**
- Envolver el contenido actual en un sistema de Tabs con dos pestanas:
  - **Broker Invoices** (contenido actual, sin cambios)
  - **Dispatch Service** (nuevo contenido)

La pestana **Dispatch Service** incluira:
- **Tarjetas de resumen**: Total Pendiente, Total Cobrado, Total Facturas DS
- **Boton "Generar Factura"** que abre un dialogo con:
  - Selector de Driver (filtrado a solo los que tienen `service_type = 'dispatch_service'`)
  - Al seleccionar un driver, se cargan automaticamente sus cargas entregadas (`status = 'delivered'`) que aun no han sido facturadas
  - Se muestra el porcentaje del driver (`dispatch_service_percentage`) y el calculo por cada carga (total_rate x porcentaje)
  - Tabla con checkbox para seleccionar cuales cargas incluir
  - Monto total calculado automaticamente
  - Boton para confirmar y generar la factura
- **Tabla de facturas generadas** con columnas: Invoice #, Driver, Cargas, Monto, Estado (editable), Fecha, Acciones (PDF, Edit, Delete)

---

### Paso 4: Hook para Dispatch Service Invoices

**Nuevo archivo: `src/hooks/useDispatchServiceInvoices.ts`**
- CRUD completo para la tabla `dispatch_service_invoices`
- Funcion para obtener el siguiente numero de factura (DSI-XXXX)

---

### Detalles tecnicos

- El calculo sera: `total_rate_de_carga * (dispatch_service_percentage / 100)` por cada carga seleccionada
- Las cargas ya facturadas se excluiran del selector (se verificara contra el campo `loads` jsonb de las facturas existentes)
- Se reutilizaran los componentes existentes (StatusBadge, StatCard, Dialog, etc.)
- La numeracion DSI-0001 sera consecutiva y automatica


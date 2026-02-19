

## Comision 2 para Dispatchers

### Resumen
Agregar un campo "Commission 2 (%)" al perfil del dispatcher y un selector en el formulario de cargas que permita elegir entre "Commission 1" (default) y "Commission 2" al crear o editar una carga.

### Cambios en la base de datos

**Nueva columna en la tabla `dispatchers`:**
- `commission_2_percentage` (numeric, default 0) -- segundo porcentaje de comision opcional

No se necesitan cambios en la tabla `loads` porque el monto calculado ya se guarda en `dispatcher_pay_amount`.

### Cambios en el codigo

**1. Perfil del Dispatcher (`DispatcherFormDialog.tsx` + `useDispatchers.ts`)**
- Agregar campo "Commission 2 (%)" debajo del campo "% Commission" existente
- Actualizar las interfaces `DbDispatcher` y `DispatcherInput` para incluir `commission_2_percentage`

**2. Formulario de Cargas (`LoadFormDialog.tsx`)**
- Agregar un estado `selectedCommissionType` con valor default `'commission_1'`
- Cuando se selecciona un dispatcher que tiene `commission_2_percentage > 0`, mostrar un selector con dos opciones:
  - "Commission 1: X%" (seleccionado por defecto)
  - "Commission 2: Y%"
- Si el dispatcher solo tiene Commission 1 (commission_2 es 0), no mostrar el selector
- Reemplazar el calculo hardcodeado `totalRate * 0.08` por el porcentaje real del dispatcher seleccionado
- Tambien corregir los calculos de `driverPay` e `investorPay` para usar los porcentajes reales del driver (`pay_percentage` e `investor_pay_percentage`) en lugar de los valores hardcodeados (0.30 y 0.15)
- Recalcular automaticamente `dispatcherPay` y `companyProfit` cuando cambie el rate o la comision

**3. Pagos de Dispatcher (`ManualDispatcherPaymentDialog.tsx`)**
- Actualmente usa `commission_percentage` o `dispatch_service_percentage` segun el `service_type` del driver
- Agregar logica para que cuando una carga fue guardada con Commission 2, el monto del pago refleje correctamente el porcentaje aplicado (ya se guarda en `dispatcher_pay_amount`, asi que no requiere cambios aqui)

**4. Grafico de Comisiones (`DispatcherCommissionsChart.tsx`)**
- Este componente calcula comisiones basandose en `commission_percentage` y `dispatch_service_percentage` del dispatcher
- No requiere cambios porque los montos reales ya estan guardados en cada carga

### Flujo del usuario
1. En el perfil del dispatcher, configura Commission 1 (ej: 8%) y Commission 2 (ej: 3.5%)
2. Al crear una carga y seleccionar ese dispatcher, aparece un selector "Commission Type"
3. Por defecto se selecciona "Commission 1: 8%"
4. Si la carga requiere el otro porcentaje, cambia manualmente a "Commission 2: 3.5%"
5. El desglose de pagos se recalcula automaticamente

### Detalles tecnicos

Migracion SQL:
```text
ALTER TABLE dispatchers
ADD COLUMN commission_2_percentage numeric NOT NULL DEFAULT 0;
```

Calculo en LoadFormDialog (reemplaza lineas 315-318):
```text
const selectedDriver = drivers.find(d => d.id === selectedDriverId);
const selectedDispatcherObj = dispatchers.find(d => d.id === selectedDispatcherId);

const driverPay = totalRate * (selectedDriver?.pay_percentage ?? 30) / 100;
const investorPay = totalRate * (selectedDriver?.investor_pay_percentage ?? 15) / 100;
const dispatcherPct = selectedCommissionType === 'commission_2'
  ? (selectedDispatcherObj?.commission_2_percentage ?? 0)
  : (selectedDispatcherObj?.commission_percentage ?? 8);
const dispatcherPay = totalRate * dispatcherPct / 100;
const companyProfit = totalRate - driverPay - investorPay - dispatcherPay;
```



# Mostrar Load Adjustments sin depender de pagos existentes

## Problema actual

La seccion "Load Adjustments" se renderiza para cargas `in_transit`, `delivered` y `tonu`, pero internamente se oculta si no hay pagos generados (`availableRecipients.length === 0`). Como los pagos solo se generan al marcar la carga como "Delivered", las cargas en `in_transit` y `tonu` nunca muestran la seccion.

## Solucion

En lugar de depender de los pagos existentes para determinar los beneficiarios, derivar los beneficiarios posibles directamente de los datos de la carga:

- Si la carga tiene un `driver_id` asignado, mostrar el checkbox "Driver"
- Si el driver asignado tiene un `investor_name` (no nulo), mostrar tambien el checkbox "Investor"
- Si no hay driver asignado, no mostrar la seccion

Esto permite crear ajustes antes de que los pagos existan. Cuando la carga se marque como "Delivered" y se generen los pagos, la propagacion a `payment_adjustments` se hara en ese momento.

## Cambios tecnicos

### 1. `src/hooks/useLoadAdjustments.ts`

Modificar la logica de `availableRecipients`:

- Consultar la tabla `loads` para obtener el `driver_id` de la carga
- Si tiene `driver_id`, consultar la tabla `drivers` para verificar si tiene `investor_name`
- Construir `availableRecipients` con "driver" (siempre si hay driver) e "investor" (si el driver tiene investor)
- Mantener la logica actual de propagacion a `payment_adjustments` solo cuando los pagos existan (para cargas delivered/paid)

### 2. `src/components/LoadAdjustmentsSection.tsx`

- Eliminar la condicion `if (!loading && availableRecipients.length === 0) return null`
- Reemplazarla por una condicion que oculte solo si no hay driver asignado (basado en los nuevos recipients)

### 3. `src/hooks/useLoadAdjustments.ts` - Propagacion diferida

- En `addAdjustment`: si no hay pagos existentes para los beneficiarios seleccionados, guardar solo en `load_adjustments` (sin propagar a `payment_adjustments`)
- La propagacion ocurrira cuando se generen los pagos (al marcar como delivered), verificando si hay load_adjustments pendientes

### 4. `src/hooks/usePayments.ts` - Propagacion al generar pagos

- En `generatePaymentsForLoad`: despues de crear los pagos, consultar `load_adjustments` de esa carga
- Para cada ajuste pendiente, crear los `payment_adjustments` correspondientes

### Archivos modificados
- `src/hooks/useLoadAdjustments.ts` - Cambiar fuente de recipients (de payments a loads/drivers)
- `src/components/LoadAdjustmentsSection.tsx` - Ajustar condicion de visibilidad
- `src/hooks/usePayments.ts` - Agregar propagacion de ajustes al generar pagos


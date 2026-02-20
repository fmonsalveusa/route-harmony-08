
## Problema identificado

La carga EXP7406566 tiene `service_type = 'owner_operator'` a nivel de carga (override correcto), pero su `dispatcher_pay_amount` guardado en la base de datos es $144 — que equivale al 6% de $1,800 (la tasa de Dispatch Service de Eric Owen), no al 4% (Commission 1).

Esto sucedio porque en algun momento el `dispatcher_pay_amount` fue calculado usando el `service_type` del perfil del driver (Jose Cruz = `dispatch_service`) en vez del `service_type` guardado en la carga (`owner_operator`).

El codigo actual en `calcCommission` tiene la siguiente logica:

```
if (stored dispatcher_pay_amount > 0) → usa el stored sin verificar
```

Esto hace que el valor incorrecto almacenado se muestre tal cual, ignorando el `service_type` real de la carga.

### Causa raiz
Hay dos problemas separados:

1. **El valor guardado ($144 / 6%) es incorrecto** para esta carga — deberia ser $72 (4%) segun el `service_type = 'owner_operator'` de la carga y la `commission_percentage = 4%` del dispatcher.
2. **La logica de calcCommission** confia ciegamente en el `dispatcher_pay_amount` almacenado sin verificarlo contra el `service_type` de la carga.

### Solucion

#### Parte 1: Corregir la logica en `ManualDispatcherPaymentDialog.tsx`

Cambiar el orden de prioridad en `calcCommission`:

- **SIEMPRE** calcular el porcentaje usando el `service_type` de la carga (`l.service_type`) para determinar que tasa aplicar.
- Usar `dispatcher_pay_amount` solo si NO existe el `service_type` en la carga (cargas muy antiguas sin ese campo).
- Si existe `service_type` en la carga → recalcular usando el porcentaje correcto del dispatcher segun ese tipo.

Nueva logica propuesta:

```
Si load.service_type existe:
  → usar el % del dispatcher segun ese service_type
  → ignorar el dispatcher_pay_amount almacenado (puede estar mal calculado)
Si load.service_type NO existe:
  → usar dispatcher_pay_amount si > 0 (fallback para cargas antiguas)
  → si tampoco existe, usar commission_percentage del dispatcher
```

#### Parte 2: Corregir el valor en la base de datos

Actualizar el `dispatcher_pay_amount` de la carga EXP7406566 de $144 (6%) a $72 (4%) para que coincida con el `service_type = owner_operator` y `commission_percentage = 4%` del dispatcher Eric Owen.

### Archivos a modificar

- `src/components/ManualDispatcherPaymentDialog.tsx` — corregir la funcion `calcCommission` para priorizar el `service_type` de la carga sobre el `dispatcher_pay_amount` almacenado.

### Resultado esperado

| Campo | Antes | Despues |
|-------|-------|---------|
| Carga EXP7406566 mostrada | 6% ($144) | 4% ($72) |
| Logica general | Confia en stored value | Prioriza service_type de la carga |

### Nota tecnica

Este cambio es seguro porque:
- Las cargas que tienen `service_type` definido calcularan siempre con el porcentaje correcto del dispatcher segun ese tipo.
- Las cargas mas antiguas sin `service_type` continuaran usando el `dispatcher_pay_amount` almacenado como fallback.
- Al momento de generar el pago, los `amount` en `dispatcher_payment_items` se calcularan con el valor correcto.

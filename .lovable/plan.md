

## Plan: Mover generacion de pagos al cambio de Factoring a "Ready"

### Problema actual
Los pagos de driver/investor se generan cuando el status de la carga cambia a `delivered`. El usuario quiere que se generen cuando el campo `factoring` se pone en `ready`.

### Cambios en `src/pages/Loads.tsx`

1. **Remover generacion de pagos del cambio de status a "delivered"** (lineas 419-423): Quitar la llamada a `generatePaymentsForLoad` cuando `val === 'delivered'`. Mantener el `setPodUploadLoadId` y la logica de `delivery_date`/`factoring` defaults.

2. **Agregar generacion de pagos al cambio de factoring a "ready"** (lineas 454-456): Cuando `val === 'ready'`, buscar el driver y dispatcher correspondientes y llamar a `generatePaymentsForLoad`. Tambien considerar: si el factoring se cambia DE "ready" a otro valor, llamar `deletePaymentsForLoad` para revertir.

3. **Mantener la logica de `deletePaymentsForLoad`** cuando el status cambia desde "delivered" a otro valor (ya que si se revierte el delivered, tampoco deberian existir pagos).

### Logica final

```
// Status change handler:
if (val === 'delivered') {
  // Set delivery_date, factoring default, open POD dialog
  // NO payment generation here
}
if (prevStatus === 'delivered' && val !== 'tonu') {
  deletePaymentsForLoad(load.id);
}

// Factoring change handler:
if (val === 'ready') {
  generatePaymentsForLoad(load, driverData, dispatcherData);
}
```

### Archivos a modificar
- `src/pages/Loads.tsx` — mover trigger de pagos del status change al factoring change


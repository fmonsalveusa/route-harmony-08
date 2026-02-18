

# Ajustes de Carga con Seleccion Dinamica de Beneficiario

## Resumen

Agregar una seccion "Ajustes de Carga" en el panel de detalle de cada carga (LoadDetailPanel). Al crear un ajuste, el usuario elige a quien aplicarlo entre los beneficiarios que realmente tienen pagos generados en esa carga. El monto se aplica al 100% a cada beneficiario seleccionado.

## Comportamiento segun beneficiarios

- Si la carga solo tiene pago de **Driver**: solo aparece el checkbox "Driver" (pre-seleccionado). No aparece "Investor".
- Si la carga tiene pagos de **Driver e Investor**: aparecen ambos checkboxes para elegir uno, el otro, o ambos.
- Si no hay pagos generados: la seccion de ajustes no se muestra.

Los checkboxes se generan dinamicamente consultando los pagos existentes de la carga (`payments WHERE load_id = X AND recipient_type IN ('driver','investor')`).

## Flujo del usuario

1. Expandir una carga en la tabla de Loads
2. En el panel de detalle, ver la seccion "Ajustes de Carga"
3. Clic en "Add Adjustment"
4. Llenar: tipo (Addition/Deduction), motivo, monto, descripcion opcional
5. Seleccionar a quien aplica (checkboxes dinamicos segun pagos existentes)
6. Guardar: se crea el ajuste en `load_adjustments` y se propaga al 100% a los `payment_adjustments` de cada beneficiario seleccionado
7. Al eliminar un ajuste de carga, se eliminan automaticamente los ajustes propagados

## Seccion tecnica

### 1. Migracion SQL

**Nueva tabla `load_adjustments`:**

```text
load_adjustments
  id              UUID PK DEFAULT gen_random_uuid()
  load_id         UUID NOT NULL
  adjustment_type TEXT NOT NULL DEFAULT 'deduction'  -- 'addition' | 'deduction'
  reason          TEXT NOT NULL DEFAULT 'other'
  description     TEXT (nullable)
  amount          NUMERIC NOT NULL DEFAULT 0
  apply_to        TEXT[] NOT NULL  -- ej: ['driver'], ['investor'], ['driver','investor']
  tenant_id       UUID (nullable)
  created_at      TIMESTAMPTZ DEFAULT now()
```

**RLS**: Mismas politicas tenant-based (SELECT, INSERT, DELETE) que las demas tablas.

**Nueva columna en `payment_adjustments`:**

```text
payment_adjustments.load_adjustment_id  UUID (nullable)
```

Esto vincula cada ajuste propagado con su origen para poder eliminarlos en cascada.

### 2. Nuevo archivo: `src/hooks/useLoadAdjustments.ts`

- `fetchAdjustments(loadId)`: consulta `load_adjustments` WHERE `load_id` = loadId
- `addAdjustment(loadId, { adjustment_type, reason, amount, description, applyTo[] })`:
  1. Inserta en `load_adjustments` con el array `apply_to`
  2. Consulta `payments` WHERE `load_id` = loadId AND `recipient_type` IN (applyTo)
  3. Por cada pago encontrado, inserta un `payment_adjustment` con el monto completo (100%) y `load_adjustment_id` = id del ajuste de carga
- `deleteAdjustment(id)`:
  1. DELETE FROM `payment_adjustments` WHERE `load_adjustment_id` = id
  2. DELETE FROM `load_adjustments` WHERE `id` = id

### 3. Nuevo archivo: `src/components/LoadAdjustmentsSection.tsx`

- Recibe `loadId` como prop
- Consulta `payments` de ese load para determinar que beneficiarios existen (driver, investor)
- Muestra lista de ajustes existentes con badges indicando a quien aplica
- Formulario inline para agregar:
  - Select: Addition / Deduction
  - Select: Motivo (reutiliza `ADJUSTMENT_REASONS` de `usePaymentAdjustments`)
  - Input: Monto
  - Input: Descripcion (opcional)
  - Checkboxes dinamicos: solo muestra los tipos de beneficiarios que tengan pagos en esa carga
- Boton eliminar por ajuste (con confirmacion)

### 4. Archivo modificado: `src/components/LoadDetailPanel.tsx`

- Importar y renderizar `LoadAdjustmentsSection` pasando `loadId`
- Solo visible cuando la carga tiene al menos un pago generado (status delivered o paid)

### Archivos nuevos
- Migracion SQL (crear tabla + agregar columna)
- `src/hooks/useLoadAdjustments.ts`
- `src/components/LoadAdjustmentsSection.tsx`

### Archivos modificados
- `src/components/LoadDetailPanel.tsx`


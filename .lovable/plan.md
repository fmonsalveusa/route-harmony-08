

## Plan: Página de Brokers con auto-detección y scores compartidos

### Concepto

Crear una nueva tabla `brokers` como directorio maestro de brokers, **sin aislamiento por tenant** (visible para todos). Cuando se cree una carga con un `broker_client` nuevo, el sistema lo registra automáticamente. Cada broker tendrá su puntuación RTS/factoring editable, reutilizando la lógica existente de `broker_credit_scores`.

### Cambios en base de datos

1. **Nueva tabla `brokers`** (sin tenant_id, compartida globalmente):
   - `id uuid PK`
   - `name text NOT NULL UNIQUE` — nombre del broker
   - `mc_number text`
   - `rating text` — letra A-F
   - `days_to_pay integer`
   - `notes text`
   - `loads_count integer DEFAULT 0`
   - `created_at`, `updated_at`
   - RLS: SELECT para todos los autenticados, INSERT/UPDATE para autenticados

2. **Trigger `auto_register_broker`** en tabla `loads`:
   - `AFTER INSERT OR UPDATE OF broker_client` — si `broker_client` no existe en `brokers`, lo inserta automáticamente.

### Nueva página `/brokers`

- Tabla con columnas: Nombre, MC#, Rating (badge color A-F), Días de Pago, Notas, # Cargas, Acciones
- Búsqueda por nombre/MC
- Edición inline o dialog para rating, days_to_pay, mc_number, notes (misma UI que `BrokerScoreRow` en LoadDetailPanel)
- Badge de factoring: A/B/C = verde "FACTORING", D/E/F = rojo "COBRO DIRECTO"
- Conteo de cargas calculado desde `loads.broker_client`

### Integración con sistema existente

- Sincronizar `brokers` ↔ `broker_credit_scores`: cuando se edite un score en la página de brokers, se actualiza `broker_credit_scores` también (o migrar para usar solo `brokers` como fuente única).
- Opción más limpia: **usar la tabla `brokers` como fuente única** y deprecar `broker_credit_scores`, actualizando `useBrokerScores` para leer de `brokers`.

### Navegación

- Agregar "Brokers" al menú en `AppLayout.tsx` (icono `Handshake` de lucide), con permission `loads` (todos los que ven cargas ven brokers).
- Ruta `/brokers` en `App.tsx` como ruta protegida.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| Migración SQL | Crear tabla `brokers`, trigger en `loads`, migrar datos existentes de `broker_credit_scores` |
| `src/hooks/useBrokers.ts` | Hook CRUD para tabla `brokers` |
| `src/pages/Brokers.tsx` | Página con tabla, búsqueda, edición de scores |
| `src/hooks/useBrokerScores.ts` | Actualizar para leer de `brokers` en vez de `broker_credit_scores` |
| `src/App.tsx` | Agregar ruta `/brokers` |
| `src/components/AppLayout.tsx` | Agregar nav item "Brokers" |


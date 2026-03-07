

## Puntuación de Broker (RTS Financial)

### Hallazgo

RTS Financial **no ofrece una API pública** para consultar la puntuación crediticia de brokers. Sus credit reports están disponibles exclusivamente dentro de la app **RTS Pro** (web y móvil), accesible solo para clientes de RTS con sesión iniciada. No es posible hacer scraping automatizado porque requiere autenticación privada.

### Alternativa propuesta: Campo manual de puntuación por broker

Dado que no hay API, la solución más práctica es permitir que el equipo ingrese manualmente la puntuación de RTS cuando la consulten, y que esa información se guarde y se muestre automáticamente en futuras cargas del mismo broker.

**1. Base de datos** — Crear tabla `broker_credit_scores`

```sql
CREATE TABLE broker_credit_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  score integer, -- e.g. 0-100
  days_to_pay integer,
  rating text, -- 'Good', 'Average', 'Poor'
  notes text,
  tenant_id uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(broker_name, tenant_id)
);
```

Con RLS para tenant isolation.

**2. LoadDetailPanel** — Mostrar badge de puntuación junto al nombre del broker
- Si el broker tiene puntuación guardada: mostrar un badge con color (verde/amarillo/rojo) y el score
- Si no tiene: mostrar un botón pequeño "Add RTS Score" que abre un mini-formulario inline

**3. Diseño visual**

```text
Broker: TQL LOGISTICS
┌──────────────────────────────┐
│  ⭐ 92  •  Avg 28 days      │  ← Verde si > 80, amarillo 50-80, rojo < 50
└──────────────────────────────┘
```

**4. Auto-completar** — Cuando se crea una nueva carga con un broker que ya tiene score guardado, se muestra automáticamente sin necesidad de volver a ingresarlo.

### Archivos a modificar
- **Migración SQL**: crear tabla `broker_credit_scores` con RLS
- `src/components/LoadDetailPanel.tsx`: mostrar badge de score y mini-formulario
- Nuevo hook `src/hooks/useBrokerScores.ts`: CRUD para scores

### Limitación
Si en el futuro RTS habilita una API o integración, se puede automatizar. Por ahora, el ingreso manual es la única opción viable.


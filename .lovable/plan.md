

## Diagnóstico del Bug

El cálculo de millas vacías (empty miles / DH-O) tiene un bug en `src/components/LoadDetailPanel.tsx`, línea 407.

### Causa raíz

Cuando el sistema busca la carga anterior de un driver para determinar dónde fue su última entrega, filtra por status:

```
.in('status', ['delivered', 'tonu'])
```

**El problema**: no incluye el status `'paid'`. Cuando una carga anterior ya fue pagada (status = `paid`), el sistema no la encuentra como "carga anterior". Entonces:
- O encuentra una carga más vieja (con status `delivered`) que tiene una dirección de entrega diferente
- O no encuentra ninguna, y no calcula millas vacías

Esto explica exactamente lo que reportas con Julio Rodriguez: su última carga ya fue marcada como `paid`, así que el sistema ignoró esa entrega y tomó una dirección incorrecta.

### Segundo problema menor

En la línea 406, la query usa `lt('delivery_date', load.pickup_date)` — compara estrictamente "menor que". Si la carga anterior tiene la misma `delivery_date` que la `pickup_date` de la nueva carga (lo cual es común en operaciones diarias), tampoco la encontrará.

---

## Plan de Corrección

### Archivo: `src/components/LoadDetailPanel.tsx`

**Cambio 1** (línea 407): Agregar `'paid'` al filtro de status:
```typescript
.in('status', ['delivered', 'paid', 'tonu'])
```

**Cambio 2** (línea 406): Cambiar `lt` a `lte` para incluir cargas con la misma fecha de entrega:
```typescript
.lte('delivery_date', load.pickup_date)
```

Y agregar `.neq('id', load.id)` para excluir la carga actual de los resultados (ya que ahora usamos `lte`):
```typescript
.neq('id', load.id)
```

### Resultado final de la query (líneas 402-409):
```typescript
const { data: prevLoads } = await supabase
  .from('loads')
  .select('id, delivery_date')
  .eq('driver_id', load.driver_id)
  .neq('id', load.id)
  .lte('delivery_date', load.pickup_date)
  .in('status', ['delivered', 'paid', 'tonu'])
  .order('delivery_date', { ascending: false })
  .limit(1);
```

### Nota importante
Las cargas que ya tienen `empty_miles` calculadas incorrectamente NO se recalcularán automáticamente (línea 321 las salta). Para forzar el recálculo en cargas existentes como la de Julio Rodriguez, el usuario puede editar manualmente el campo "Empty Miles Origin" desde el panel de detalle de la carga.




## Plan

**Archivo: `src/pages/DriverRouteHistory.tsx`**

Agregar un filtro a la query de Supabase para excluir solo las cargas con `status = 'cancelled'`. Se añade `.neq('status', 'cancelled')` a la consulta existente de loads (una sola línea).


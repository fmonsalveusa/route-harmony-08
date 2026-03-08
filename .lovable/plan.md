

## Plan: Contador rojo de brokers sin rating en la navegación

### Contexto
- Ya existe un trigger `auto_register_broker` que inserta automáticamente brokers nuevos cuando se crea una carga -- esto ya funciona.
- La tabla `brokers` no tiene `tenant_id`, así que el conteo es global.
- En `AppLayout.tsx` ya hay un patrón idéntico para drivers pendientes (badge naranja en el nav item de Drivers).

### Cambios

**1. `src/components/AppLayout.tsx`**
- Añadir un estado `unratedBrokers` (similar a `pendingDrivers`).
- En un `useEffect`, consultar `brokers` donde `rating IS NULL`, obtener el count.
- Suscribirse al canal realtime de `brokers` para refrescar automáticamente.
- En ambos navs (desktop y mobile), mostrar un badge rojo junto al item "Brokers" cuando `unratedBrokers > 0`.

**2. Sin cambios en la base de datos** -- el trigger `auto_register_broker` ya se encarga de registrar brokers nuevos al crear cargas.

### Detalle técnico

```text
AppLayout
├── pendingDrivers state (existing)
├── unratedBrokers state (NEW)
│   ├── useEffect: SELECT count(*) FROM brokers WHERE rating IS NULL
│   ├── realtime channel on 'brokers' table → refetch count
│   └── render red badge on '/brokers' nav item
```

El badge será rojo (`bg-destructive`) para diferenciarlo del naranja de drivers pendientes.


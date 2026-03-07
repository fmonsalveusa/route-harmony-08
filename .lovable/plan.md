

# Cambiar default de Route History a "This Week"

## Problema
Route History abre por defecto en "Last Week" mientras el Dashboard muestra "This Week", causando confusión al comparar cifras.

## Cambio
Un solo cambio en `src/pages/DriverRouteHistory.tsx`, línea 107:

```
// Antes
const [period, setPeriod] = useState('last_week');

// Después
const [period, setPeriod] = useState('this_week');
```

Esto alinea ambas páginas para mostrar la semana actual por defecto.


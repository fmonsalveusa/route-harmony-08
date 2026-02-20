

## Limitar ancho maximo del Timeline en monitores grandes

### Problema
En monitores anchos/ultrawide, cada dia se estira proporcionalmente sin limite, dejando barras de carga con demasiado espacio vacio y dificultando la lectura visual.

### Solucion
Agregar un limite maximo de ancho por dia (`MAX_DAY_WIDTH`) para que el timeline no se estire mas alla de un punto razonable. Cuando el monitor es muy ancho, el timeline se centrara o quedara alineado a la izquierda con un ancho maximo controlado.

### Cambios tecnicos

**Archivo: `src/components/dashboard/DriversTimelineCard.tsx`**

- Agregar constante `MAX_DAY_WIDTH = 280` (aproximadamente el doble del minimo, suficiente para buena legibilidad sin exceso)
- Modificar el calculo de `dayWidth` para incluir el tope maximo:
  ```
  Math.min(MAX_DAY_WIDTH, Math.max(MIN_DAY_WIDTH, (containerWidth - DRIVER_COL_WIDTH - 16) / VISIBLE_DAYS))
  ```
- Esto limita cada dia a un maximo de 280px (~1960px de grid total), evitando el estiramiento excesivo en pantallas ultrawide

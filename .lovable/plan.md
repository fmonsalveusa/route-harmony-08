
## Timeline Responsivo - Ajuste Dinamico al Tamano de Ventana

### Que se va a hacer
Actualmente el timeline usa un ancho fijo de 8px por hora (192px por dia), lo que causa scroll horizontal en pantallas pequenas y desperdicia espacio en pantallas grandes. Se cambiara para que el ancho se calcule dinamicamente basado en el espacio disponible del contenedor.

### Como funciona

1. Se agrega un `ResizeObserver` al contenedor del timeline que mide el ancho disponible en tiempo real
2. Se resta el ancho fijo de la columna de drivers (140px) y un margen
3. Se divide el espacio restante entre los 7 dias para obtener el ancho por dia
4. Se establece un minimo de 120px por dia para que las barras no queden ilegibles

### Cambios tecnicos

**Archivo: `src/components/dashboard/DriversTimelineCard.tsx`**

- Eliminar las constantes fijas `HOUR_WIDTH_PX` y `DAY_WIDTH_PX`
- Agregar un `ref` al contenedor principal y un estado `containerWidth`
- Usar `useEffect` con `ResizeObserver` para medir el ancho del contenedor
- Calcular `dayWidth` dinamicamente: `Math.max(120, (containerWidth - DRIVER_COL_WIDTH - 16) / VISIBLE_DAYS)`
- Reemplazar todas las referencias a `DAY_WIDTH_PX` por el valor calculado
- Recalcular `totalGridWidth` como `VISIBLE_DAYS * dayWidth`
- Si el contenedor es muy angosto (menos de 120px por dia), mantener el scroll horizontal como fallback

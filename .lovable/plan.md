

## Diagnóstico

El código actual **sí** usa `pickup_date` tanto para filtrar como para ordenar las cargas. Sin embargo, el problema de continuidad visual se debe a que **cada carga se dibuja como una polilínea independiente** sin conexión entre ellas. No hay una línea que una la última parada de la carga N con la primera parada de la carga N+1, lo que rompe la percepción de un recorrido continuo.

Además, cuando una carga tiene múltiples paradas con fechas distintas (ej: pickup el lunes, delivery el miércoles), el orden cronológico real debería considerar las **fechas de las paradas individuales** (`load_stops.date`), no solo el `pickup_date` de la carga.

## Plan de corrección

**Archivo: `src/pages/DriverRouteHistory.tsx`**

1. **Ordenar cargas por `pickup_date` y como desempate por `delivery_date`** para que cargas con el mismo pickup se ordenen correctamente.

2. **Dibujar líneas de conexión entre cargas**: Una polilínea punteada gris/tenue que conecte la última parada de la carga anterior con la primera parada de la carga siguiente, mostrando el "deadhead" o recorrido vacío entre cargas.

3. **Mantener la numeración global secuencial** de paradas a través de todas las cargas para reflejar el orden cronológico real del conductor.

Esto dará la sensación visual de un recorrido continuo donde se ve claramente: carga 1 (color A) → conexión punteada → carga 2 (color B) → conexión punteada → carga 3 (color C), etc.


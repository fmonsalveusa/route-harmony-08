
Objetivo: devolver el detalle de la carga al comportamiento estable de ayer: mapa rápido, paradas visibles de inmediato, millas calculadas, RPM visible y punto de origen de empty miles apareciendo sin demoras innecesarias.

1. Restaurar el flujo estable del mapa en `LoadDetailPanel`
- Quitar la dependencia fuerte del `fetch` separado de `route_geometry` antes de renderizar.
- Volver a pintar primero con lo que ya existe en `dbStops` y/o `load.route_geometry`, sin esperar una segunda consulta.
- Mantener el “fast path” real: si ya hay coordenadas de stops, mostrar marcadores y ruta inmediatamente.

2. Revertir la parte riesgosa de la optimización reciente
- Deshacer el cambio donde una sola llamada `drivingRouteWithLegs` pasó a ser responsable tanto de la geometría como de las millas.
- Recuperar el comportamiento anterior:
  - ruta: usar caché si existe; si no, calcularla;
  - millas: calcularlas por separado con fallback confiable cuando `distance_from_prev` falte.
- Si la llamada optimizada falla o no llena legs correctamente, usar fallback inmediato para que nunca queden `Miles` y `RPM` en blanco.

3. Corregir el cálculo de millas para cargas como la 591799
- Caso confirmado: la carga tiene `route_geometry` y `empty_miles`, pero `loads.miles = 0` y `load_stops.distance_from_prev = null`.
- Ajustar la lógica para que:
  - si `load.miles` es 0 pero hay stops con coords, se calculen y persistan las distancias faltantes;
  - si no se pueden persistir de inmediato, igual se calcule `totalMiles` en memoria para mostrar `Miles` y `RPM` en la UI;
  - `onMilesCalculated` nunca guarde 0 cuando ya existe una ruta válida o distancias derivables.

4. Acelerar el punto de origen de empty miles
- Mostrar primero el marcador/origen con los datos ya guardados (`empty_miles_origin`, coords previas si existen) antes de hacer geocoding o ruta.
- Dejar el cálculo de la polilínea del deadhead como mejora progresiva: primero marcador, luego línea.
- Evitar que el origen dependa de búsquedas adicionales del último load si ya hay origen cacheado.

5. Restaurar la ruta del deadhead sin bloquear el mapa
- Dibujar la ruta principal de la carga primero.
- Después resolver la ruta del punto de origen a pickup.
- Si OSRM tarda o falla, usar línea recta temporal para no dejar el mapa “vacío”.

6. Proteger el rendimiento y evitar nuevas regresiones
- Separar claramente:
  - render inicial del mapa,
  - cálculo de millas,
  - cálculo de empty miles.
- Evitar recalcular todo cuando solo cambia `route_geometry` o cuando llega un refetch menor.
- Mantener firmas/guards para no destruir y recrear el mapa innecesariamente.

7. Limpieza secundaria
- Corregir los warnings de refs en `PickupPicturesSection` y `PodUploadSection`, porque no parecen ser la causa principal del problema, pero sí ensucian el ciclo de render y deben quedar resueltos después del rollback funcional.

Diagnóstico resumido
- La regresión viene del cambio reciente en `LoadDetailPanel`: ahora el detalle espera más de lo necesario para renderizar y además depende demasiado de la nueva ruta optimizada.
- En el caso real inspeccionado (`591799`), la ruta está guardada, pero las millas no, y el flujo actual no está recuperando bien esas distancias.
- También el origen de empty miles se está dibujando tarde porque hoy depende de pasos extra antes de mostrar algo en el mapa.

Resultado esperado tras implementar
- Al abrir una carga:
  - las paradas aparecen rápido,
  - la ruta aparece rápido,
  - `Miles` y `RPM` se muestran aunque haya que reconstruirlos,
  - el punto de la última parada/origen de empty miles aparece primero y su ruta se completa después,
  - se recupera el comportamiento estable que tenías ayer.

Detalles técnicos
- Archivos principales: `src/components/LoadDetailPanel.tsx`, revisión menor en `src/pages/Loads.tsx`.
- No parece requerir cambios de base de datos.
- En vez de “seguir parchando” la optimización reciente, la forma más segura es un rollback parcial de esa lógica y luego reintroducir solo las mejoras que no rompan el fast path.
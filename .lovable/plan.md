

## Mostrar columna de Driver en la tabla de Loads en todas las pantallas

### Problema
La columna "Driver/Truck" en la tabla de Loads tiene la clase `hidden md:table-cell`, lo que la oculta en pantallas menores a 768px. Como el administrador usa el layout web estándar (no el layout móvil optimizado), al entrar desde un teléfono esta columna desaparece.

### Solución
Hacer que la columna Driver siempre sea visible, independientemente del tamaño de pantalla. Se mantendrá el nombre del truck como dato secundario pero se simplificará en pantallas pequeñas.

### Cambios

**`src/pages/Loads.tsx`**
1. En el header de la tabla (línea 350): quitar `hidden md:table-cell` de la columna "Driver/Truck" para que siempre sea visible
2. En la celda de datos (línea 381): quitar `hidden md:table-cell` para que siempre se muestre el nombre del driver y truck

Esto asegura que el nombre del driver siempre aparezca en la tabla, tanto en desktop como en móvil.


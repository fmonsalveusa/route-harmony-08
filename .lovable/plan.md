

## Cómo probar que el detalle de cargas funciona correctamente

Para verificar que las mejoras están funcionando, sigue estos pasos:

### 1. Probar con una carga existente (como 2957886 o 591799)
- Abre la página de **Loads**
- Haz clic en una carga para expandir su detalle
- Verifica que:
  - Los marcadores P y D aparecen **inmediatamente** en el mapa
  - La ruta se dibuja (primero puede ser línea recta, luego se reemplaza por la ruta real)
  - **Miles** y **RPM** se llenan en pocos segundos, no minutos
  - El punto de origen de empty miles (marcador "E") aparece en el mapa
  - Las **empty miles** se muestran en el panel de detalle

### 2. Probar editando una carga
- Edita las direcciones de origen/destino de una carga
- Cierra y vuelve a abrir el detalle
- Verifica que se recalculan las millas y la ruta con las nuevas direcciones

### 3. Probar con una carga nueva
- Crea una carga nueva con origen y destino válidos
- Abre su detalle y verifica que todo se calcula desde cero correctamente

### Tiempos esperados
- Marcadores y ruta cacheada: **inmediato** (< 1 segundo)
- Cálculo de millas si faltan: **5-15 segundos**
- Empty miles y punto de origen: **5-15 segundos**
- Si tarda más de 30 segundos, algo no está funcionando bien

¿Quieres que lo pruebe yo directamente en el preview?


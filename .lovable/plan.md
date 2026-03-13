

## Problema

El preview de Lovable carga desde un iframe que puede mantener módulos JS en caché del navegador (no solo Service Worker). La limpieza actual en `main.tsx` solo elimina Service Workers y Cache API, pero el **caché HTTP del navegador** (disk cache) sigue sirviendo versiones antiguas de los chunks JS que contienen la función `generateTerminationLetterPdf`.

Esto explica por qué la app publicada siempre muestra el formato correcto (deploy fresco) pero el preview a veces muestra el formato anterior.

## Solución

No hay una solución de código que resuelva esto permanentemente desde el lado de la app — es un comportamiento del navegador en el entorno de preview. Sin embargo, podemos mitigar el problema:

1. **Agregar headers de no-cache para el preview** en `vite.config.ts`: Configurar headers del servidor de desarrollo para evitar que el navegador cachee los módulos JS.

   En `server` config, agregar:
   ```ts
   headers: {
     'Cache-Control': 'no-store, no-cache, must-revalidate',
   }
   ```

2. **Forzar limpieza más agresiva en preview**: Además de limpiar SW y Cache API, intentar forzar una recarga sin caché si se detecta que es la primera carga después de un cambio.

Esto debería reducir significativamente el problema de ver formatos antiguos en el preview.

## Archivos a modificar

- `vite.config.ts` — agregar `headers` con `Cache-Control: no-store` en la config de `server`


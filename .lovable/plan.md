

# Habilitar Botones de Escaneo BOL/POD en Android

## Resumen
Actualmente el boton de escaneo de documentos (con deteccion de bordes y recorte) solo aparece en iOS y Desktop. En Android se oculta debido a limitaciones historicas del navegador. El cambio es simple: **eliminar la restriccion `!isAndroid`** para que el boton de Scanner aparezca en todas las plataformas, igualando la experiencia entre iPhone y Android.

---

## Cambio Propuesto

### Archivo a modificar: `src/components/driver-app/StopCard.tsx`

1. **Eliminar la condicion `{!isAndroid && ...}`** que envuelve el boton de Scanner (linea 404)
2. El boton "Scan BOL Document" / "Scan POD Document" aparecera en **todas las plataformas** (Android, iOS, Desktop)
3. El `DocumentScanner` ya esta importado y funcional -- solo estaba oculto en Android

### Que queda igual
- Los botones de "Camera" y "Gallery" no cambian
- La logica interna del DocumentScanner (deteccion de bordes, crop, enhance, upload) no cambia
- No se requieren cambios en la base de datos ni en edge functions

### Nota tecnica
El DocumentScanner usa `createImageBitmap` y canvas para el procesamiento de imagenes, que ya es compatible con Chrome en Android. La deteccion de bordes se ejecuta en el servidor (edge function), asi que no depende del navegador del dispositivo.


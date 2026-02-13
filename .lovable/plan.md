

## Escaner de documentos real con soporte multi-pagina

### Objetivo
Reemplazar el boton actual "Scanear BOL/POD" (que solo abre la camara) con un verdadero escaner de documentos que incluya:
- Captura de foto con la camara del movil
- Vista previa de cada pagina escaneada con opcion de re-tomar
- Mejora automatica de imagen (alto contraste, blanco y negro para documentos)
- Soporte para escanear multiples paginas antes de enviar
- Interfaz de pantalla completa optimizada para movil

### Comportamiento del usuario
1. El driver pulsa "Scanear BOL" o "Scanear POD"
2. Se abre un dialogo de pantalla completa (modal)
3. Captura una foto con la camara
4. Ve la vista previa de la pagina escaneada con opciones:
   - **Mejorar**: aplica filtro de alto contraste blanco/negro (modo documento)
   - **Re-tomar**: descarta y vuelve a capturar
   - **Agregar pagina**: captura otra pagina adicional
5. Puede ver todas las paginas escaneadas en una galeria de miniaturas
6. Puede eliminar paginas individuales
7. Al pulsar **"Subir todo"**, todas las paginas se suben al storage

### Cambios planificados

**1. Nuevo componente: `src/components/driver-app/DocumentScanner.tsx`**
- Dialogo de pantalla completa con fondo oscuro
- Utiliza Canvas API para procesamiento de imagen:
  - Conversion a escala de grises
  - Aumento de contraste (threshold adaptativo)
  - Resultado: imagen limpia tipo "escaneado"
- Estado interno con array de paginas escaneadas (como data URLs)
- Galeria de miniaturas en la parte inferior
- Botones: "Agregar pagina", "Subir todo", "Cancelar"
- Convierte cada pagina procesada a Blob para subir al storage

**2. Modificar: `src/components/driver-app/StopCard.tsx`**
- Importar el nuevo componente `DocumentScanner`
- El boton "Scanear BOL/POD" ahora abre el `DocumentScanner` en lugar de un input file
- El `DocumentScanner` recibe como props: `stop`, `loadRef`, `driverName`, `onUpdate` y maneja internamente la subida de archivos

### Detalles tecnicos

- **Procesamiento de imagen con Canvas API** (sin dependencias externas):
  - `getImageData()` para acceder a los pixeles
  - Conversion a escala de grises: promedio ponderado de canales RGB
  - Contraste adaptativo: umbral (threshold) para binarizar la imagen simulando un escaneo real
  - Resultado exportado como JPEG de alta calidad
- **Multi-pagina**: array de `{ original: string, enhanced: string }` en estado local
- **Sin nuevas dependencias**: todo se logra con APIs nativas del navegador (Canvas, FileReader, Camera API)
- **No requiere cambios en la base de datos**: usa el mismo flujo de subida a storage y tabla `pod_documents` existente



## Firma Digital de 3 Documentos en el Onboarding

### Resumen
Se agrega un nuevo **Step 3: "Firma de Documentos"** al onboarding del driver, donde debe revisar y firmar digitalmente 3 documentos. Los datos ingresados en pasos anteriores se pre-llenan automaticamente. Se genera un PDF firmado por cada documento que se sube al storage y se guarda en el perfil del driver.

### Flujo actualizado del usuario

```text
Step 1: Driver Info (sin cambios)
    |
Step 2: Truck Info (sin cambios)  
    |
Step 3: Firma de Documentos (NUEVO)
    |   - 3 tarjetas: W-9 Form, Leasing Agreement, Service Agreement
    |   - Cada una abre un dialog para revisar, completar campos faltantes y firmar
    |   - Solo avanza cuando los 3 estan firmados
    |
Step 4: Review & Submit (el actual Step 3 se mueve aqui)
```

### Documentos y campos

**1. W-9 Form**
- Pre-llenado: Name (del driver)
- Campos adicionales: Business Name, Federal Tax Classification (checkboxes), Exemptions, Address, City/State/Zip, SSN o EIN
- Firma + Fecha

**2. Leasing Agreement (Owner Operator Lease Agreement + ELD Policy + HOS Policy)**
- Pre-llenado: Owner Operator Name, Make, Model, VIN, Year (del truck)
- Campo adicional: Owner Operator Company Name
- 3 firmas requeridas: Contrato principal, ELD Policy, HOS Policy
- Fechas automaticas

**3. Contrato de Servicios de Dispatch**
- Pre-llenado: Nombre del conductor
- Campo adicional: Direccion del conductor
- Firma + Fecha (bilingual Spanish/English)

### Archivos nuevos a crear

**1. `src/components/onboarding/SignaturePad.tsx`**
- Canvas HTML5 tactil (touch + mouse)
- Boton "Limpiar" para re-firmar
- Exporta firma como dataURL (imagen PNG)
- Optimizado para moviles

**2. `src/components/onboarding/DocumentSigningStep.tsx`**
- 3 tarjetas con estado: Pendiente / Firmado (check verde)
- Boton "Revisar y Firmar" en cada tarjeta
- Boton "Next" deshabilitado hasta que los 3 esten firmados

**3. `src/components/onboarding/W9FormDialog.tsx`**
- Dialog fullscreen con el formulario W-9
- Campos del W-9 (nombre, business name, tax classification, address, SSN/EIN)
- Pre-llena nombre del driver
- SignaturePad al final
- Al confirmar, genera PDF con jsPDF

**4. `src/components/onboarding/LeasingAgreementDialog.tsx`**
- Dialog fullscreen con el contenido completo del Leasing Agreement
- Muestra las 3 secciones: Contrato, ELD Policy, HOS Policy
- Pre-llena: Owner Operator Name, Make, Model, VIN, Year
- Campo editable: Owner Operator Company Name
- 3 SignaturePads (uno por seccion)
- Al confirmar, genera PDF con jsPDF

**5. `src/components/onboarding/ServiceAgreementDialog.tsx`**
- Dialog fullscreen con el Contrato de Servicios de Dispatch (bilingual)
- Pre-llena: Nombre del conductor
- Campo editable: Direccion
- SignaturePad al final
- Al confirmar, genera PDF con jsPDF

**6. `src/lib/onboardingDocPdf.ts`**
- `generateW9Pdf(data, signature): Blob` - Genera PDF del W-9 con campos completados y firma
- `generateLeasingPdf(driverData, truckData, signatures): Blob` - Genera PDF del Leasing (contrato + ELD + HOS) con 3 firmas
- `generateServiceAgreementPdf(data, signature): Blob` - Genera PDF del contrato de servicios con firma
- Usa jsPDF (ya instalado) para crear los documentos

### Modificaciones a archivos existentes

**`src/pages/DriverOnboarding.tsx`**
- Stepper cambia de 3 a 4 pasos: labels "Driver Info", "Truck Info", "Documents", "Review"
- Nuevo estado para almacenar los PDFs firmados (Blobs): `signedDocs`
- Step 3 renderiza `DocumentSigningStep` pasando datos del driver y truck
- Step 4 (Review) muestra resumen de documentos firmados
- Al enviar, los PDFs se adjuntan al FormData como `driver_form_w9`, `driver_leasing_agreement`, `driver_service_agreement`
- Se eliminan "Form W9", "Leasing Agreement" y "Service Agreement" de `DRIVER_DOC_FIELDS` (ya no se suben manualmente)

### Sin cambios en backend
- La Edge Function `driver-onboarding` ya maneja los campos `driver_form_w9`, `driver_leasing_agreement`, `driver_service_agreement` y los sube al storage correctamente
- Los URLs se guardan en los campos `form_w9_url`, `leasing_agreement_url`, `service_agreement_url` de la tabla `drivers`
- No se requieren cambios en la base de datos ni en la Edge Function

### Detalles tecnicos

- Los PDFs se generan en el frontend con jsPDF, renderizando el texto del documento pagina por pagina con la firma incrustada como imagen
- Los archivos se nombran `w9_signed.pdf`, `leasing_agreement_signed.pdf`, `service_agreement_signed.pdf` al adjuntarlos al FormData
- El SignaturePad usa canvas con eventos touch y mouse para compatibilidad movil
- Los dialogs usan scroll interno para documentos largos
- Cada documento muestra la fecha actual automaticamente junto a la firma


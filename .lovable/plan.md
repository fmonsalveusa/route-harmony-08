

# PDF Resumen de Onboarding (Driver + Truck)

## Objetivo

Crear una funcion `generateOnboardingSummaryPdf` que genere un PDF profesional con toda la informacion del driver y del truck capturada durante el onboarding. El PDF se descargara automaticamente al completar el onboarding y tambien estara disponible como boton de descarga en la pantalla de exito.

## Ubicacion

El codigo de generacion del PDF ira en `src/lib/onboardingDocPdf.ts` donde ya existen las funciones de generacion de W-9, Leasing y Service Agreement. Se reutilizaran los helpers existentes (`writeBlock`, `writeHeading`).

## Contenido del PDF

```text
┌─────────────────────────────────────────┐
│  [Logo]  DRIVER ONBOARDING SUMMARY      │
│  Date: MM/DD/YYYY                       │
├─────────────────────────────────────────┤
│  DRIVER INFORMATION                     │
│  ─────────────────                      │
│  Name:           John Smith             │
│  Email:          john@example.com       │
│  Phone:          555-0000               │
│  License #:      CDL-A-12345            │
│  State:          TX                     │
│  License Exp:    12/31/2025             │
│  Medical Exp:    06/30/2025             │
│  Documents:      License Photo ✓        │
│                  Medical Card ✓         │
├─────────────────────────────────────────┤
│  TRUCK INFORMATION                      │
│  ─────────────────                      │
│  Unit #:         101                    │
│  Type:           Box Truck              │
│  Make/Model:     Freightliner Cascadia  │
│  Year:           2022                   │
│  VIN:            1FUJG...               │
│  License Plate:  TX-4521               │
│  Max Payload:    26,000 lbs            │
│  Insurance Exp:  12/31/2025            │
│  Registration:   06/30/2025            │
│  [Dimensions si aplica]                │
│  Documents:      Registration ✓         │
│                  Insurance ✓            │
│                  ...                    │
├─────────────────────────────────────────┤
│  SIGNED DOCUMENTS                       │
│  ─────────────────                      │
│  ✓ W-9 Form                            │
│  ✓ Leasing Agreement                   │
│  ✓ Service Agreement                   │
└─────────────────────────────────────────┘
```

## Cambios por archivo

### 1. `src/lib/onboardingDocPdf.ts`
Agregar funcion `generateOnboardingSummaryPdf(data)` al final del archivo. Recibe:
- `driverData`: name, email, phone, license, state, license_expiry, medical_card_expiry
- `truckData`: unit_number, truck_type, make, model, year, vin, license_plate, max_payload_lbs, insurance_expiry, registration_expiry, cargo dimensions, mega_ramp
- `driverDocs`: lista de nombres de archivos subidos
- `truckDocs`: lista de nombres de archivos subidos  
- `signedDocs`: { w9: boolean, leasing: boolean, service: boolean }
- `date`: fecha de completado

Usa los helpers existentes (`writeBlock`, `writeHeading`) para consistencia con los demas PDFs.

### 2. `src/pages/DriverOnboarding.tsx`
- Importar `generateOnboardingSummaryPdf` desde `onboardingDocPdf.ts`
- En `handleSubmit`, despues de recibir respuesta exitosa, generar el PDF y guardarlo en una variable de estado (`summaryPdfBlob`)
- En la pantalla de "Onboarding Complete", agregar un boton "Download Summary PDF" que descargue el blob guardado
- El PDF se genera del lado del cliente con los datos que ya estan en memoria (no requiere llamada al backend)

## Detalles tecnicos

- Se usa `jsPDF` que ya esta instalado en el proyecto
- No requiere cambios en el backend ni en la base de datos
- El PDF se genera localmente con los datos del formulario antes de limpiar el estado
- El boton de descarga usa `URL.createObjectURL` + un `<a>` temporal para disparar la descarga


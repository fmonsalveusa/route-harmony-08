

# Importacion Masiva de Drivers (Uso Unico)

## Resumen

Crear un wizard de importacion CSV para drivers siguiendo el mismo patron del LoadImportWizard existente. Wizard de 4 pasos: Upload, Mapeo de columnas, Validacion y Confirmacion.

## Campos mapeables

**Obligatorios:** Name, Email, Phone, License
**Opcionales:** License Expiry, Medical Card Expiry, Status, Service Type, Dispatcher (por nombre), Truck (por unit number), Investor Name, Pay Percentage, Investor Pay Percentage, Factoring Percentage, Hire Date

## Validaciones

- Duplicados por email o license (case-insensitive)
- Fechas invalidas en license_expiry, medical_card_expiry, hire_date
- Dispatchers no encontrados por nombre
- Trucks no encontrados por unit_number
- Emails con formato invalido
- Porcentajes fuera de rango (0-100)

## Archivos a crear

### `src/components/drivers/DriverImportWizard.tsx`
- Wizard de 4 pasos identico en estructura al LoadImportWizard
- Deteccion automatica de delimitador (coma, punto y coma, tab)
- Auto-deteccion de columnas por nombre de header
- Tabla de validacion con colores (verde/amarillo/rojo)
- Checkboxes para saltar filas problematicas
- Barra de progreso durante importacion
- Boton para descargar plantilla CSV de ejemplo
- Importacion en lotes de 50

## Archivos a modificar

### `src/hooks/useDrivers.ts`
- Agregar funcion `createDriversBulk(inputs: DriverInput[]): Promise<{success: number, errors: number}>`
- Inserta en lotes de 50 con el tenant_id del usuario
- Invalida (refetch) al finalizar

### `src/pages/Drivers.tsx`
- Agregar boton "Import CSV" con icono Upload junto al boton "New Driver"
- Integrar el DriverImportWizard como dialogo modal
- Pasar drivers existentes, trucks y dispatchers como props para validacion

## Detalles tecnicos

- Matching de dispatchers por nombre (case-insensitive, trim)
- Matching de trucks por unit_number (case-insensitive)
- Deteccion de duplicados contra drivers existentes por email o license
- Valores por defecto: status="available", service_type="owner_operator", pay_percentage=0, factoring_percentage=0, hire_date=hoy
- Cada registro incluye el tenant_id del usuario autenticado via getTenantId()




# Importacion Masiva de 200 Cargas (Uso Unico)

## Resumen

Crear un wizard simple de importacion CSV para cargar las 200 cargas de una sola vez. Seguira el mismo patron del FuelImportWizard existente pero adaptado para cargas.

## Flujo

1. El admin hace clic en "Import CSV" en la pagina de Loads
2. Sube el archivo CSV
3. Mapea las columnas del CSV a los campos de la tabla loads
4. Revisa y valida los datos (duplicados, fechas invalidas, drivers/trucks no encontrados)
5. Confirma la importacion - se insertan en lotes de 50

## Archivos a crear

### `src/components/loads/LoadImportWizard.tsx`
- Wizard de 4 pasos: Upload, Mapeo de columnas, Validacion, Confirmacion
- Reutiliza el patron visual del FuelImportWizard (mismos componentes UI, misma estructura de pasos)
- Campos mapeables:
  - **Obligatorios**: Reference Number, Origin, Destination, Total Rate
  - **Opcionales**: Pickup Date, Delivery Date, Miles, Weight, Broker/Client, Driver (nombre), Truck (unit number), Status, Cargo Type, Notes, Driver Pay, Dispatcher Pay, Investor Pay
- Validacion: detecta duplicados por reference_number, fechas invalidas, drivers/trucks que no existen
- Codificacion por colores: verde (valido), amarillo (advertencia), rojo (error)
- Checkboxes para saltar filas problematicas
- Barra de progreso durante la importacion
- Boton para descargar plantilla CSV de ejemplo

## Archivos a modificar

### `src/hooks/useLoads.ts`
- Agregar funcion `createLoadsBulk(inputs: CreateLoadInput[]): Promise<{success: number, errors: number}>`
- Inserta en lotes de 50 con el tenant_id del usuario
- Invalida la cache al finalizar

### `src/pages/Loads.tsx`
- Agregar boton "Import CSV" con icono Upload junto al boton "New Load"
- Integrar el LoadImportWizard como dialogo modal
- Pasar drivers, trucks y loads existentes como props para validacion

## Detalles tecnicos

- Parseo de CSV con deteccion automatica de delimitador (coma, punto y coma, tab)
- Matching de drivers por nombre (case-insensitive, trim)
- Matching de trucks por unit_number o plate_number
- Insercion en lotes de 50 registros usando `supabase.from('loads').insert(batch)`
- Cada registro incluye el tenant_id del usuario autenticado
- Al finalizar, `queryClient.invalidateQueries` para refrescar la lista


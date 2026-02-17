

## Filtrar Trucks en el formulario de Mantenimiento

### Cambio
En el dialogo "Add Maintenance Schedule" (`MaintenanceFormDialog.tsx`), la lista de trucks actualmente muestra todos los camiones. Se filtrara para mostrar **solo los trucks que tengan un driver asignado con `service_type === 'company_driver'`**.

### Detalle tecnico

**Archivo:** `src/components/maintenance/MaintenanceFormDialog.tsx`

1. Crear una lista filtrada de trucks al inicio del componente:
   - Filtrar `trucks` donde `truck.driver_id` exista Y el driver correspondiente en la lista `drivers` tenga `service_type === 'company_driver'`
   - Usar esta lista filtrada (`companyDriverTrucks`) en el `<Select>` de trucks y para el valor por defecto

2. Actualizar el `useEffect` de inicializacion para usar `companyDriverTrucks[0]?.id` como valor por defecto en vez de `trucks[0]?.id`

3. En el `<SelectContent>` del truck selector, iterar sobre `companyDriverTrucks` en lugar de `trucks`

**Logica del filtro:**
```text
const companyDriverTrucks = trucks.filter(t => {
  const driver = drivers.find(d => d.id === t.driver_id);
  return driver && driver.service_type === 'company_driver';
});
```

Esto asegura que solo se puedan programar mantenimientos para camiones operados por Company Drivers, ya que son los vehiculos gestionados directamente por la empresa.


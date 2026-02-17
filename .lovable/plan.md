

# Notificaciones Automaticas de Mantenimiento via Cron Job

## Problema Actual
Las notificaciones de mantenimiento solo se generan cuando alguien abre la pagina de Maintenance. Si nadie la visita, los mantenimientos pueden vencer sin que nadie reciba una alerta.

## Solucion
Crear una Edge Function que se ejecute automaticamente cada dia, recalcule el estado de todos los mantenimientos y genere notificaciones cuando corresponda.

## Archivo a Crear

### 1. `supabase/functions/maintenance-check/index.ts`
Edge Function que:
- Consulta todos los registros de `truck_maintenance` con sus datos de truck
- Para cada registro, consulta las cargas (`loads`) desde `last_performed_at` y suma `miles + empty_miles`
- Calcula el nuevo `status` usando los umbrales existentes (80% = warning, 100% = due)
- Tambien evalua el status por fecha (`next_due_date` - 30 dias = warning, vencido = due)
- Si el status empeora (de "ok" a "warning", o de "warning" a "due"), inserta una notificacion en la tabla `notifications`
- Actualiza `miles_accumulated` y `status` en `truck_maintenance`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS (ya configurado en secrets)

### 2. Cron Job (SQL insert via herramienta de base de datos)
Programar la funcion para ejecutarse diariamente a las 6:00 AM UTC:
```text
Frecuencia: 0 6 * * *  (cada dia a las 6 AM UTC)
Endpoint: /functions/v1/maintenance-check
```
Requiere habilitar las extensiones `pg_cron` y `pg_net`.

## Flujo de Ejecucion

```text
Cron (6 AM diario)
  |
  v
Edge Function: maintenance-check
  |
  +-- Para cada tenant:
  |     +-- Obtener todos los truck_maintenance
  |     +-- Para cada registro:
  |     |     +-- Sumar miles + empty_miles de loads desde last_performed_at
  |     |     +-- Calcular status por millas (ok/warning/due)
  |     |     +-- Calcular status por fecha (ok/warning/due)
  |     |     +-- Tomar el peor status
  |     |     +-- Si status empeoro -> INSERT notificacion
  |     |     +-- UPDATE miles_accumulated y status
  |     +-- Fin
  +-- Responder 200 OK
```

## Detalles Tecnicos

- La Edge Function usara `createClient` con `SUPABASE_SERVICE_ROLE_KEY` para tener acceso completo a todas las tablas sin restricciones de RLS
- Se agruparan los registros por `tenant_id` para que cada notificacion se asocie al tenant correcto
- Solo se creara notificacion si el status **empeora** (evita notificaciones duplicadas cada dia)
- Se habilitaran las extensiones `pg_cron` y `pg_net` via migracion SQL
- El cron job se registrara via SQL insert (no migracion, ya que contiene datos especificos del proyecto)

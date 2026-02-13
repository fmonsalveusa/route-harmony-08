

# Notificacion en la app web cuando un driver completa el onboarding

## Que se hara

Cuando un conductor complete el proceso de onboarding publico, se creara automaticamente una notificacion en la tabla `notifications` para que los administradores la vean en tiempo real a traves de:
- La campana de notificaciones (NotificationBell)
- Un toast persistente en la esquina inferior derecha (LiveNotificationToasts)

Al hacer clic en la notificacion, se redirigira a la pagina de Drivers.

## Cambios

### 1. Edge Function `driver-onboarding/index.ts`
Agregar un INSERT en la tabla `notifications` despues de completar el onboarding exitosamente (justo antes de marcar el token como completado). La notificacion incluira:
- `type`: `"new_driver_onboarded"`
- `title`: `"New Driver Registered"`
- `message`: Nombre del conductor y numero de unidad del camion
- `tenant_id`: El tenant correspondiente

### 2. Componente `LiveNotificationToasts.tsx`
- Agregar el tipo `new_driver_onboarded` al mapa de iconos (usando icono `UserPlus`) y colores (verde).
- Modificar `handleClick` para que cuando el tipo sea `new_driver_onboarded`, redirija a `/drivers` en lugar de `/loads`.

---

## Detalles tecnicos

En `driver-onboarding/index.ts`, agregar antes del paso 5 (mark token as completed):

```typescript
await supabaseAdmin.from("notifications").insert({
  tenant_id: tenantId,
  type: "new_driver_onboarded",
  title: "New Driver Registered",
  message: `${driverData.name} completed onboarding — Unit ${truckData.unit_number}`,
  driver_id: driverId,
});
```

En `LiveNotificationToasts.tsx`:
- Importar `UserPlus` de lucide-react
- Agregar `new_driver_onboarded: UserPlus` al mapa de iconos
- Agregar `new_driver_onboarded: 'text-green-500'` al mapa de colores
- En `handleClick`, navegar a `/drivers` cuando `toast.type === 'new_driver_onboarded'`


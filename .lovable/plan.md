
# Fix: GPS Tracking se apaga al navegar entre pantallas

## Problema
Cada ruta del driver (`/driver`, `/driver/loads`, etc.) esta envuelta individualmente en `<DriverRoute>`, que crea una nueva instancia de `<DriverTrackingProvider>` en cada navegacion. Al cambiar de pantalla, el provider se desmonta y se vuelve a montar, reiniciando el estado de tracking a `false` y deteniendo el GPS.

## Solucion
Mover el `<DriverTrackingProvider>` fuera de `<DriverRoute>` para que envuelva todas las rutas del driver una sola vez, evitando que se desmonte al navegar.

---

## Detalles tecnicos

### Archivo: `src/App.tsx`

1. **Eliminar** `<DriverTrackingProvider>` de dentro del componente `DriverRoute`.
2. **Envolver** todas las rutas `/driver/*` con un layout route que contenga `<DriverTrackingProvider>` una sola vez.

El componente `DriverRoute` pasara de:

```text
DriverRoute
  -> DriverTrackingProvider (se crea cada vez)
    -> DriverMobileLayout
      -> children
```

A una estructura donde el provider vive arriba de todas las rutas:

```text
DriverTrackingProvider (una sola instancia)
  -> DriverRoute
    -> DriverMobileLayout
      -> children
```

Concretamente:
- Crear un componente wrapper `DriverWrapper` que contenga la logica de autenticacion + `DriverTrackingProvider` + `DriverMobileLayout` y use `<Outlet />` para renderizar las rutas hijas.
- Reemplazar las 6 rutas individuales `/driver/*` por una ruta padre con rutas anidadas.

Esto garantiza que el contexto de tracking persista mientras el conductor navega entre Home, Loads, Tracking, Payments y Profile.

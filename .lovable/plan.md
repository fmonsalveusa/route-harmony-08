
# Corregir Recarga al Cambiar de Pestaña

## Problema
Cuando el usuario cambia a otra pestaña del navegador y regresa, la app se recarga y pierde el estado actual (dialogos abiertos, formularios en progreso, detalles desplegados).

## Causas identificadas

### 1. React Query refetch en foco
`QueryClient` tiene `refetchOnWindowFocus: true` por defecto. Cada vez que la pestaña vuelve a estar activa, todas las queries se re-ejecutan, lo que causa que los componentes se re-rendericen y los dialogos/formularios se cierren.

### 2. Service Worker auto-recarga
En `main.tsx`, el service worker detecta actualizaciones y llama `updateSW(true)` automaticamente, lo que recarga toda la pagina. Ademas hay un `setInterval` cada 60 segundos que busca actualizaciones.

---

## Solucion

### Archivo: `src/App.tsx` (linea 45)
Configurar `QueryClient` para desactivar el refetch automatico al cambiar de pestaña:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos antes de considerar datos obsoletos
    },
  },
});
```

Esto evita que los datos se recarguen al regresar a la pestaña. Los datos se seguiran actualizando por Supabase Realtime (que ya esta implementado en la mayoria de los hooks) y por las acciones del usuario (crear, editar, eliminar).

### Archivo: `src/main.tsx` (lineas 14-29)
Cambiar la estrategia del service worker para no recargar la pagina automaticamente:

```typescript
const updateSW = registerSW({
  onNeedRefresh() {
    // Solo loguear; la actualizacion se aplicara en la proxima navegacion natural
    console.log("New version available - will update on next reload");
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
  immediate: true,
});

// Reducir frecuencia de chequeo a cada 5 minutos (no cada 60 segundos)
setInterval(() => {
  updateSW();
}, 5 * 60 * 1000);
```

Esto elimina la recarga forzada. La nueva version se aplicara la proxima vez que el usuario recargue manualmente o navegue.

---

## Resultado esperado
- Los dialogos y formularios abiertos se mantendran al cambiar de pestaña
- Los datos no se recargaran agresivamente al volver
- Los datos seguiran actualizandose via Realtime y acciones del usuario
- Las actualizaciones del service worker se aplicaran de forma no intrusiva

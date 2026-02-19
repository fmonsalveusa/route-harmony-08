

## Problema
La app se congela mostrando el spinner de carga indefinidamente. El `AuthContext` espera la respuesta de la base de datos sin un limite de tiempo, y si la conexion es lenta o falla, la app nunca pasa del estado `loading`.

## Solucion

Agregar un timeout de seguridad en `AuthContext.tsx` para que si `fetchUserData` tarda mas de 10 segundos, se libere el estado de carga y se muestre la app (redirigiendo al login si no hay sesion).

### Cambios tecnicos

**Archivo: `src/contexts/AuthContext.tsx`**

1. Agregar un timeout de 10 segundos al bloque de `getSession()` en el `useEffect`. Si la promesa de `fetchUserData` no se resuelve en ese tiempo, forzar `setLoading(false)` para desbloquear la UI.

2. Envolver `fetchUserData` en un try/catch para manejar errores de red silenciosos que podrian dejar la app en estado de carga permanente.

```text
useEffect:
  getSession() ->
    si hay sesion:
      Promise.race([
        fetchUserData(userId),
        timeout de 10s
      ]).finally(() => setLoading(false))
    si no:
      setLoading(false)
```

Esto garantiza que la app nunca se quede congelada, y en el peor caso, redirige al usuario al login despues de 10 segundos.


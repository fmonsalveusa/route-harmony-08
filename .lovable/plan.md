

# Fix: Error al crear usuario con rol Driver

## Problema encontrado

El error "Edge Function returned a non-2xx status code" ocurre por un desajuste en la validacion de la contrasena:

- El formulario en la UI acepta contrasenas de **6 caracteres** minimo (`minLength={6}`)
- La Edge Function requiere **8 caracteres** minimo

Si se ingresa una contrasena de 6 o 7 caracteres, el formulario la acepta pero el backend la rechaza con un error 400.

Adicionalmente, el mensaje de error del backend no se muestra correctamente al usuario porque la respuesta viene como `{ error: "..." }` pero el codigo verifica `data?.error` solo despues de verificar `error` del SDK, que a veces envuelve el mensaje real.

## Solucion

### 1. Alinear validacion del formulario (UserFormDialog.tsx)

Cambiar `minLength={6}` a `minLength={8}` en el campo de password y actualizar el placeholder para indicar "Minimo 8 caracteres".

### 2. Mejorar mensaje de error

Asegurar que cuando el backend retorna un error de validacion, el toast muestre el mensaje real (ej: "Password must be at least 8 characters") en vez del generico "Edge Function returned a non-2xx status code".

## Cambios tecnicos

| Archivo | Cambio |
|---|---|
| `src/components/UserFormDialog.tsx` | Cambiar `minLength={6}` a `minLength={8}`, actualizar placeholder, mejorar manejo de error en catch |

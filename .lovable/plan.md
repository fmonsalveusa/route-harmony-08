

## Plan: Auto-completar datos de broker desde FMCSA

Ya tienes la infraestructura lista. La edge function `lookup-broker-mc` ya existe y consulta la API de FMCSA por nombre, devolviendo `mc_number`, `dot_number` y `legal_name`. La API key `FMCSA_API_KEY` ya está configurada como secret.

### Lo que falta

1. **Agregar columnas `dot_number` y `address` a la tabla `brokers`** — actualmente solo tiene `mc_number`.

2. **Ampliar la edge function** para extraer también la dirección física (`phyStreet`, `phyCity`, `phyState`, `phyZipcode`) de la respuesta FMCSA.

3. **Botón "Buscar en FMCSA"** en el diálogo de edición del broker — al hacer clic, llama a la edge function con el nombre del broker y auto-rellena MC#, DOT# y dirección.

4. **Auto-lookup en el trigger** (opcional) — cuando se registra un broker nuevo automáticamente desde una carga, la edge function podría invocarse para pre-poblar los datos. Sin embargo, esto añade complejidad (llamada HTTP desde un trigger). La opción más práctica es hacerlo desde el frontend.

### Cambios específicos

| Archivo/Recurso | Cambio |
|---|---|
| Migración SQL | `ALTER TABLE brokers ADD COLUMN dot_number text, ADD COLUMN address text` |
| `supabase/functions/lookup-broker-mc/index.ts` | Extraer `phyStreet`, `phyCity`, `phyState`, `phyZipcode` y devolver campo `address` |
| `src/hooks/useBrokers.ts` | Agregar `dot_number` y `address` al tipo `Broker` y al `updateBroker` |
| `src/pages/Brokers.tsx` | Agregar columnas DOT# y Dirección a la tabla; agregar botón "Buscar FMCSA" en el diálogo de edición que invoque la función y pre-llene los campos |

### Flujo del usuario

1. Abre el diálogo de edición de un broker
2. Hace clic en "Buscar en FMCSA"
3. El sistema busca por nombre → devuelve MC#, DOT#, dirección, legal name
4. Los campos se auto-rellenan en el formulario
5. El usuario revisa y guarda


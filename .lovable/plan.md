

## Escalar UI de la app movil del driver para Android

### Problema
En Samsung Android los textos y elementos se ven muy pequenos debido a la alta densidad de pixeles. En Apple se ve bien porque iOS maneja el escalado de forma diferente.

### Solucion
Subir un nivel todos los tamanos de fuente, iconos y espaciado en las paginas del driver.

### Archivos a modificar

**1. `src/components/driver-app/DriverMobileLayout.tsx`**
- Header: `h-14` a `h-16`, logo `h-7 w-7` a `h-8 w-8`, titulo `text-sm` a `text-base`
- Iconos header (bell, logout): subir un nivel
- GPS indicator: `text-[10px]` a `text-xs`
- Tab bar: `h-16` a `h-[72px]`, iconos `h-5 w-5` a `h-6 w-6`, labels `text-[10px]` a `text-xs`
- Banner geofence: textos de `text-xs` a `text-sm`

**2. `src/pages/driver-app/DriverDashboard.tsx`**
- Saludo: `text-xl` a `text-2xl`
- Subtitulo: `text-sm` a `text-base`
- Stats numeros: `text-2xl` a `text-3xl`, labels `text-xs` a `text-sm`
- Cards de loads activos: subir textos un nivel (xs a sm, sm a base)
- Padding: `p-4` a `p-5`

**3. `src/pages/driver-app/DriverLoadDetail.tsx`**
- Titulo load: `text-lg` a `text-xl`
- Rate: `text-lg` a `text-xl`
- Textos secundarios: subir un nivel
- Botones: textos de `text-xs` a `text-sm`

**4. `src/components/driver-app/StopCard.tsx`**
- Titulo parada: `text-sm` a `text-base`
- Direccion y fecha: `text-xs` a `text-sm`
- Botones: `text-xs` a `text-sm`, iconos un nivel mas grandes
- Thumbnails: `h-14 w-14` a `h-16 w-16`

**5. `src/pages/driver-app/DriverLoads.tsx`**
- Titulo pagina y tabs: subir un nivel
- Cards de loads: textos de xs a sm, sm a base

**6. `src/pages/driver-app/DriverPayments.tsx`**
- Montos y textos: subir un nivel

**7. `src/pages/driver-app/DriverProfile.tsx`**
- Labels y valores: subir un nivel
- Iconos: un nivel mas grandes

**8. `src/pages/driver-app/DriverTracking.tsx`**
- Textos y botones: subir un nivel

### Resultado
Todo el contenido del driver app sera ~25% mas grande, resolviendo el problema de visibilidad en dispositivos Samsung Android sin afectar la experiencia en Apple.

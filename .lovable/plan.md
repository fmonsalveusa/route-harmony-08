

# Rediseno Visual de la App del Conductor (Estilo SmartHop)

## Resumen
Redisenar visualmente toda la app movil del conductor inspirandose en el estilo limpio y profesional de SmartHop, e incorporar funcionalidades operativas relevantes para conductores (descartando busqueda/negociacion/booking de cargas).

---

## Cambios Visuales Globales

### 1. Header y Bottom Tab Bar (DriverMobileLayout)
- Fondo del header con degradado sutil azul oscuro (#1e3a5f) en lugar de blanco plano
- Texto del header en blanco para contraste
- Bottom tab bar con indicador naranja activo (linea superior o punto) en vez de solo color de texto
- Iconos ligeramente mas grandes (h-7 w-7) con transicion suave

### 2. Tarjetas de Carga Rediseñadas (SmartHop Trip Card Style)
- **Origen/Destino como protagonistas**: ciudades en texto grande y bold, con una linea vertical punteada conectando pickup y delivery (estilo timeline visual)
- **Grid de datos**: Rate, RPM, Miles y Broker en un grid 2x2 compacto con etiquetas en gris y valores en bold
- **Status badge** con esquinas mas redondeadas y colores consistentes con el sistema arcoiris existente
- **Borde izquierdo de color** segun status (linea de 3px a la izquierda de la card)

### 3. Dashboard del Conductor (DriverDashboard)
- **Stat cards con iconos mas grandes** y fondo con gradiente sutil
- **Agregar 2 stats adicionales**: "Miles this month" y "Avg RPM" (calculados de las cargas del mes)
- **Seccion "Next Stop"**: card destacada que muestra el proximo stop pendiente con boton directo de navegacion a Google Maps (inspirado en el trip summary de SmartHop)
- **Barra de progreso de la carga activa**: indicador visual de en que paso va la carga (Dispatched > In Transit > Pickup > Delivery)

### 4. Detalle de Carga (DriverLoadDetail)
- **Header con fondo de color** segun status (sutil gradiente)
- **Seccion de ruta visual**: timeline vertical con circulos de pickup (verde) y delivery (rojo) conectados por linea punteada, mostrando ciudad/estado y fecha
- **Datos financieros en card con grid**: Rate, RPM, Miles, Driver Pay en un grid limpio similar a SmartHop
- **Boton de Rate Confirmation** mas destacado con icono de PDF

### 5. Pagina de Pagos (DriverPayments)
- **Stat cards con gradiente** consistente con el dashboard
- **Payment cards con linea lateral de color** (verde = paid, naranja = pending)
- Agregar icono de descarga de recibo cuando el pago es "paid"

### 6. Perfil del Conductor (DriverProfile)
- **Avatar circular grande** en la parte superior con iniciales del nombre
- **Cards agrupadas** con bordes mas suaves y espaciado mas generoso
- **Badges de estado** para documentos proximos a vencer (amarillo/rojo)

---

## Funcionalidades Nuevas (Relevantes para Conductores)

### 7. Seccion "Next Stop" en Dashboard
- Muestra automaticamente el siguiente stop pendiente (sin arrived_at) de la carga activa
- Incluye: direccion, tipo (Pickup/Delivery), boton "Navigate" directo
- Se calcula desde las cargas activas y sus stops

### 8. Barra de Progreso de Carga
- Indicador horizontal con los pasos: Dispatched > In Transit > On Site > Picked Up/Delivered
- Se muestra en el Dashboard (carga activa) y en el Load Detail
- Cada paso completado se ilumina con el color del sistema

### 9. Resumen de Millas del Mes
- Calcula total de millas de las cargas completadas en el mes
- Calcula RPM promedio del mes
- Se muestra en el grid de stats del dashboard (4 cards en vez de 2)

### 10. Indicador de Documentos por Vencer en el Perfil
- Badges con countdown (dias restantes) para licencia y medical card
- Color amarillo si quedan menos de 30 dias, rojo si quedan menos de 7

---

## Detalles Tecnicos

### Archivos a Modificar
1. **`src/components/driver-app/DriverMobileLayout.tsx`** - Header/tab bar con nuevo estilo
2. **`src/pages/driver-app/DriverDashboard.tsx`** - Rediseno completo: stats grid 2x2, next stop, progress bar
3. **`src/pages/driver-app/DriverLoads.tsx`** - Load cards con nuevo layout (timeline visual, borde de color, grid de datos)
4. **`src/pages/driver-app/DriverLoadDetail.tsx`** - Header colorido, timeline de ruta, grid financiero, progress bar
5. **`src/pages/driver-app/DriverPayments.tsx`** - Stat cards con gradiente, borde lateral en payment cards
6. **`src/pages/driver-app/DriverProfile.tsx`** - Avatar, badges de expiracion, layout mas generoso
7. **`src/components/driver-app/StopCard.tsx`** - Bordes mas suaves, iconos mas claros

### Archivo Nuevo
8. **`src/components/driver-app/LoadProgressBar.tsx`** - Componente reutilizable de barra de progreso de carga

### No Requiere Cambios de Base de Datos
Toda la informacion necesaria (millas, RPM, stops, expiraciones) ya existe en las tablas actuales. Solo se agregan calculos en el frontend.


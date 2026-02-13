

## Notificaciones persistentes en tiempo real para la app web

### Objetivo
Cuando un driver ejecute acciones clave (marcar llegada, subir fotos/POD, cambiar estado), aparecera un panel de notificaciones "toast" persistente en la esquina inferior derecha de la pantalla principal de la app web. Estas notificaciones se mantendran visibles hasta que el usuario las cierre o haga clic en ellas, momento en que sera redirigido a la pagina relevante (ej. detalle de la carga).

### Comportamiento
- Las notificaciones apareceran como tarjetas apiladas en la esquina inferior derecha
- Cada tarjeta mostrara: icono del tipo de accion, nombre del driver, descripcion de la accion (ej. "Juan Perez arrived at Pick Up - 123 Main St")
- Se mantendran visibles hasta que el usuario haga clic o las cierre manualmente con una "X"
- Al hacer clic, redirigiran a la pagina de Loads donde podran ver los detalles
- Maximo 5 notificaciones visibles a la vez (las mas nuevas reemplazan las mas antiguas)
- Animacion de entrada suave (slide-in desde la derecha)

### Cambios planificados

**1. Nuevo componente: `src/components/LiveNotificationToasts.tsx`**
- Componente que se suscribe al canal de Supabase Realtime en la tabla `notifications`
- Escucha eventos `INSERT` y muestra tarjetas persistentes
- Cada tarjeta incluye: icono segun tipo, titulo, mensaje, timestamp, boton de cerrar
- Al hacer clic en la tarjeta: marca como leida + navega a `/loads`
- Auto-limita a 5 notificaciones visibles simultaneamente
- Animaciones con Framer Motion (ya instalado) para entrada/salida

**2. Modificar: `src/components/AppLayout.tsx`**
- Importar y renderizar `<LiveNotificationToasts />` dentro del layout principal, justo antes del cierre del div principal
- Solo se mostrara para usuarios con roles admin/dispatcher (no para drivers, ya que ellos usan la app movil)

### Detalles tecnicos

- Reutiliza la suscripcion Realtime existente en la tabla `notifications` (ya configurada con `supabase_realtime`)
- Filtra notificaciones por `tenant_id` del usuario autenticado para seguridad
- Usa `framer-motion` para animaciones `AnimatePresence` con transiciones slide + fade
- Estado local con `useState` para la lista de toasts activos (independiente del hook `useNotifications` existente que maneja el historial en la campana)
- No requiere cambios en la base de datos ni nuevas migraciones


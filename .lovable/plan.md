

## Propuesta: Separar visualmente Registro y Reunión

### Problema
Los dos botones "Registrate Gratis" y "Agendar Reunión" están lado a lado en el hero, con estilos similares (ambos sólidos, mismo tamaño). El visitante no distingue cuál acción tomar primero.

### Solución propuesta

**Hero: Un solo CTA principal (Registro)**
- Mantener solo el botón naranja "Registrate Gratis" como CTA principal del hero.
- Debajo, agregar un texto sutil tipo "¿Prefieres hablar primero?" con un link de texto (no botón) que baje al meeting section.

**Sección intermedia: Banner flotante para Reunión**
- Crear un banner/strip visual entre secciones (después de Testimonios o después de Servicios) dedicado exclusivamente a agendar reunión.
- Fondo verde/oscuro diferenciado, con icono de calendario, texto persuasivo ("Habla con nuestro equipo en 15 min") y un solo botón verde "Agendar Reunión".
- Esto le da su propio espacio visual, separado del registro.

### Cambios técnicos

1. **`HeroSection.tsx`**: Quitar el botón verde de "Agendar Reunión". Reemplazarlo con un enlace de texto sutil debajo del CTA naranja.

2. **Crear `MeetingBanner.tsx`**: Nuevo componente — un banner full-width con fondo oscuro/verde, headline corto, y botón que lleva a `#meeting`. Se inserta entre secciones en `Landing.tsx`.

3. **`Landing.tsx`**: Insertar `MeetingBanner` después de `TestimonialsSection` (o `ServicesSection`) para que sea visible sin competir con el registro.

Resultado: cada acción tiene su propio espacio visual, colores distintos, y contexto claro.


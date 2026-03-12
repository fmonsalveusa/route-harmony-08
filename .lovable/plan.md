

## Rediseno de Landing Page - Inspirado en Logity Dispatch

### Resumen

Redisenar visualmente la landing page tomando como inspiracion el estilo limpio, moderno y profesional de logitydispatch.com, manteniendo toda la funcionalidad existente (servicios con modal/pricing/Stripe, onboarding de drivers, meeting scheduling, AI chat widget, WhatsApp).

### Cambios de diseno principales

**1. Navbar (`LandingNavbar.tsx`)**
- Fondo blanco/claro (en vez de azul oscuro), logo a la izquierda, links centrados, boton CTA rojo/accent a la derecha con numero de telefono
- Mantener links existentes: Servicios, Como Funciona, Vehiculos, Contacto + Iniciar Sesion + Registrate como Driver
- Sticky con sombra sutil al hacer scroll

**2. Hero (`HeroSection.tsx`)**
- Layout split: texto a la izquierda (fondo blanco/muy claro), imagen del truck a la derecha (estilo Logity)
- Titulo grande bold con palabra clave en color accent (naranja)
- Subtitulo descriptivo
- Formulario de contacto rapido inline (nombre, email, telefono) con boton CTA tipo "Registrate Gratis" - este formulario reutiliza la logica existente del OnboardingSection
- Badges de tipo de vehiculo debajo del formulario (Hot Shot, Box Truck)

**3. Servicios (`ServicesSection.tsx`)**
- Tabs horizontales por categoria (como Logity: "Dispatching", "Compliance", "Software", etc.)
- Cards con imagen, titulo y descripcion corta en grid
- Modal de detalle mantiene la funcionalidad actual (pricing, Stripe, WhatsApp CTA)

**4. Ventajas / "The Dispatch Up Advantage" (nuevo componente, reemplaza `HowItWorks.tsx`)**
- Grid de 6 iconos con titulo y descripcion corta
- Estilo limpio con iconos en circulos accent

**5. Vehiculos (`VehicleGallery.tsx`)**
- Cards horizontales con imagen del vehiculo, nombre y porcentaje/precio
- Estilo mas moderno con hover effects

**6. Seccion "About / Numeros" (nueva seccion)**
- Contadores animados: anos de experiencia, cargas despachadas, revenue promedio
- Fondo con gradiente suave

**7. Meeting + Onboarding**
- Mantener funcionalidad intacta, ajustar styling al nuevo tema claro
- El formulario de onboarding se integra en el hero y tambien se mantiene como seccion independiente

**8. FAQ Section (nueva, reemplaza o complementa)**
- Acordeon con preguntas frecuentes sobre servicios, precios, etc.

**9. Footer (`LandingFooter.tsx`)**
- Fondo oscuro, CTA final "No manejes vacio, maneja con Dispatch Up"
- Mantener links de contacto existentes

**10. Tema general**
- Fondo predominante blanco/gris muy claro en vez del azul oscuro actual
- Accent color naranja se mantiene para CTAs
- Tipografia mas grande y bold en titulos
- Mas espaciado y aire entre secciones

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/landing/LandingNavbar.tsx` | Redisenar a navbar blanca con accent CTA |
| `src/components/landing/HeroSection.tsx` | Layout split con formulario inline |
| `src/components/landing/ServicesSection.tsx` | Tabs por categoria, cards modernizadas |
| `src/components/landing/HowItWorks.tsx` | Convertir a "Ventajas" grid 6 iconos |
| `src/components/landing/VehicleGallery.tsx` | Cards modernas con pricing |
| `src/components/landing/OnboardingSection.tsx` | Ajustar styling (funcionalidad intacta) |
| `src/components/landing/MeetingSection.tsx` | Ajustar styling (funcionalidad intacta) |
| `src/components/landing/LandingFooter.tsx` | Redisenar con CTA final |
| `src/pages/Landing.tsx` | Agregar nuevas secciones (Stats, FAQ) |

### Funcionalidad que NO cambia
- Modal de servicios con pricing y Stripe checkout
- Formulario de onboarding (create-onboarding-token)
- Formulario de meeting (send-meeting-request)
- AI Chat Widget
- WhatsApp button/links
- servicesData.ts (datos y precios intactos)




# Landing Page Promocional - Load Up TMS

## Vision General
Crear una landing page profesional y moderna en `/landing` que promocione los servicios de dispatching y transporte de la empresa, con imagenes de Box Trucks y Hotshots, formulario de onboarding integrado para conductores, y contacto directo via WhatsApp y email.

---

## Secciones de la Pagina

### 1. Hero Section
- Titulo impactante sobre servicios de dispatching y transporte
- Subtitulo descriptivo
- Imagen de fondo o lateral de camiones (Box Truck / Hotshot)
- Botones CTA: "Registrate como Driver" y "Contactanos por WhatsApp"

### 2. Servicios Principales (6 tarjetas)
- **Dispatching para MC# propio** - Servicio de dispatch para clientes que ya tienen su propio MC#
- **Leasing bajo nuestro MC#** - Para conductores que desean operar bajo el MC# de la empresa
- **Curso de Dispatcher** - Formacion profesional para nuevos dispatchers
- **Tracking Up App** - Aplicacion de tracking en tiempo real para flotas
- **Asesoria Personal** - Consultoria personalizada para el negocio de transporte
- **Tramite de Permisos (DOT, MC#)** - Gestion de permisos y licencias federales

### 3. Como Funciona
- 3 pasos visuales: Contactanos -> Selecciona tu servicio -> Comienza a operar

### 4. Seccion de Onboarding para Drivers
- Formulario rapido (nombre, email, telefono, tipo de truck)
- Al enviarlo, genera un token de onboarding y redirige al formulario completo existente en `/onboarding/:token`
- Conectado directamente con la logica existente de `onboarding_tokens`

### 5. Galeria / Tipos de Vehiculos
- Imagenes de Box Trucks y Hotshots generadas con IA
- Descripcion breve de cada tipo de servicio por vehiculo

### 6. Footer
- Contacto WhatsApp: +1 (980) 766-8815 (con link directo `wa.me/19807668815`)
- Email de contacto
- Logo de la empresa
- Links a redes sociales (si aplica)

---

## Detalles Tecnicos

### Archivos nuevos
| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Landing.tsx` | Pagina principal que compone todas las secciones |
| `src/components/landing/HeroSection.tsx` | Banner hero con CTA y imagen |
| `src/components/landing/ServicesSection.tsx` | Grid de 6 servicios |
| `src/components/landing/HowItWorks.tsx` | Pasos del proceso |
| `src/components/landing/OnboardingSection.tsx` | Formulario rapido de registro de drivers |
| `src/components/landing/VehicleGallery.tsx` | Galeria de tipos de vehiculos |
| `src/components/landing/LandingFooter.tsx` | Footer con contacto WhatsApp y email |
| `src/components/landing/LandingNavbar.tsx` | Barra de navegacion simple para la landing |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar ruta publica `/landing` sin autenticacion |

### Flujo del Onboarding desde la Landing

```text
Landing (/landing)
      |
      v
Driver llena mini-formulario
(nombre, email, telefono, tipo de truck)
      |
      v
Se crea registro en onboarding_tokens
con tenant_id predeterminado
      |
      v
Redireccion a /onboarding/:token
(formulario completo existente)
```

### Generacion de Imagenes
- Se usara el modelo de IA (google/gemini-2.5-flash-image) para generar imagenes profesionales de Box Trucks y Hotshots
- Las imagenes se suben al storage del proyecto y se referencian en los componentes

### Diseno y Estilo
- Colores de marca: azul oscuro (#1e3a5f) y naranja vibrante (accent)
- Animaciones con Framer Motion (scroll reveals, hover effects)
- Totalmente responsive (mobile-first)
- Fuente Inter (ya configurada)
- Boton flotante de WhatsApp en esquina inferior derecha

### Manejo del Tenant
- Para la landing publica, se necesita definir un `tenant_id` predeterminado que se usara al crear tokens de onboarding desde la landing
- Se puede configurar como una constante o como una Edge Function que maneje la creacion del token sin exponer el tenant_id en el frontend

### Integracion WhatsApp
- Link directo: `https://wa.me/19807668815?text=Hola,%20me%20interesa%20informacion%20sobre%20sus%20servicios`
- Boton flotante siempre visible en la pagina


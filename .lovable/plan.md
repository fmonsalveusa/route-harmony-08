

## Simplificar el registro de Driver en la Landing Page

### Problema
El llamado a registrarse como Driver aparece 4 veces en la landing page, lo cual puede sentirse repetitivo y agresivo para el visitante.

### Propuesta

Mantener el formulario de registro SOLO en la seccion OnboardingSection (al final de la pagina), que ya tiene el patron de boton oculto que revela el formulario. Eliminar o cambiar las demas referencias:

**1. Navbar** - Cambiar "Registrate" por "Servicios" o simplemente eliminarlo (ya hay links a servicios y contacto). Alternativa: dejarlo pero con texto mas sutil como "Para Drivers".

**2. Hero Section** - Reemplazar el boton "Registrate como Driver" por algo mas general orientado a los servicios, como "Conoce Nuestros Servicios" que haga scroll a la seccion de servicios. Asi el hero vende la empresa, no empuja al registro.

**3. Servicios (Load Up TMS)** - Cambiar el CTA de "Registrarse ahora" por "Contactar por WhatsApp" como los demas servicios, para mantener consistencia.

**4. OnboardingSection** - Se mantiene igual. Es el unico lugar donde aparece el formulario de registro de Driver con su boton "Registrate como Driver".

### Resultado
El registro aparece una sola vez al final de la pagina, de forma sutil (oculto tras un boton). El resto de la landing se enfoca en mostrar servicios y generar confianza antes de pedir el registro.

### Seccion tecnica

Archivos a modificar:
- `src/components/landing/HeroSection.tsx` - Cambiar el primer boton de "Registrate como Driver" a "Conoce Nuestros Servicios" apuntando a `#servicios`
- `src/components/landing/LandingNavbar.tsx` - Eliminar el link "Registrate" del array `navLinks`
- `src/components/landing/ServicesSection.tsx` - Cambiar el CTA del servicio "Load Up TMS" (linea 131) de `{ label: "Registrarse ahora", href: "#onboarding" }` a `{ label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=..." }`
- `src/components/landing/OnboardingSection.tsx` - Sin cambios, se mantiene como el unico punto de registro


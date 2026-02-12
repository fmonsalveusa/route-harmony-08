

# Tarjetas de servicio con imagen + Modal informativo

## Resumen

Se agregara una imagen representativa a cada tarjeta de servicio en la landing page. Al hacer clic en una tarjeta, se abrira un modal con informacion detallada del servicio (sin imagen), incluyendo descripcion extendida, beneficios, requisitos y un boton de accion.

## Cambios visibles para el usuario

- Cada tarjeta de servicio mostrara una imagen en la parte superior (antes del icono y titulo)
- Las tarjetas seran clickeables con cursor pointer
- Al hacer clic se abre un modal con:
  - Icono y titulo del servicio
  - Descripcion detallada y extensa
  - Lista de beneficios con iconos de check
  - Boton de accion: contactar por WhatsApp o registrarse

## Imagenes por servicio

| Servicio | Imagen |
|----------|--------|
| Dispatching MC# propio | Captura del dashboard o imagen de dispatcher trabajando |
| Leasing bajo MC# | Camion en carretera (se puede reusar `landing-hotshot.jpg` o `landing-boxtruck.jpg`) |
| Curso de Dispatcher | Persona capacitandose / pantalla de formacion |
| Tracking Up App | Mapa con tracking de camiones |
| Asesoria Personal | Reunion de consultoria profesional |
| Tramite de Permisos | Documentos DOT/MC# |
| Load Up TMS | Captura real del Dashboard y pagina de Cargas de la app |

Para Load Up TMS se tomaran capturas reales de la aplicacion. Para los demas servicios se generaran imagenes con IA o se reutilizaran las existentes (`landing-boxtruck.jpg`, `landing-hotshot.jpg`).

## Detalles tecnicos

### Archivo a modificar: `src/components/landing/ServicesSection.tsx`

1. **Ampliar el array `services`** con nuevos campos:
   - `image`: ruta a la imagen (en `src/assets/services/`)
   - `details`: descripcion larga para el modal
   - `benefits`: array de strings con beneficios clave
   - `cta`: objeto con `label` (texto del boton) y `href` (link a WhatsApp o seccion de registro)

2. **Agregar estado** `selectedService` (indice o null) para controlar el modal

3. **Modificar la tarjeta** para incluir:
   - Imagen en la parte superior con `aspect-ratio` 16:9, bordes redondeados superiores
   - `onClick` para abrir el modal
   - `cursor-pointer` en el className

4. **Agregar un Dialog** (reutilizando `src/components/ui/dialog.tsx`) que muestre:
   - Icono y titulo
   - Descripcion detallada
   - Lista de beneficios con iconos Check de lucide-react
   - Boton CTA (WhatsApp abre `https://wa.me/19807668815?text=...`, registro hace scroll a la seccion de onboarding)

### Imagenes nuevas a crear: `src/assets/services/`

- Se generaran 5-6 imagenes con IA usando el modelo `google/gemini-2.5-flash-image` desde una edge function temporal, o se agregaran directamente al proyecto
- Para "Load Up TMS" se usara un screenshot real del Dashboard
- Para "Leasing" se puede reusar `landing-boxtruck.jpg` ya existente
- Formato JPG, tamano aproximado 800x450px

### Sin dependencias nuevas
- Se reutiliza Dialog de Radix UI y framer-motion existentes
- Imagenes como imports estaticos de Vite


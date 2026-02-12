

# Agregar Load Up TMS como servicio en la Landing Page

## Cambio
Agregar una nueva tarjeta de servicio "Load Up TMS" en el componente `ServicesSection.tsx` para promocionar el sistema de gestion de transporte como producto.

## Detalle Tecnico

### Archivo a modificar
- `src/components/landing/ServicesSection.tsx`

### Cambio especifico
Agregar un septimo elemento al array `services` con los datos del Load Up TMS:
- **Icono**: `Monitor` o `LayoutDashboard` de lucide-react (representando un software/dashboard)
- **Titulo**: "Load Up TMS"
- **Descripcion**: Software de gestion de transporte completo. Control de cargas, pagos, conductores, flota y reportes en una sola plataforma.

El grid actual usa `lg:grid-cols-3`, por lo que con 7 tarjetas se mantendra bien distribuido (3 columnas en desktop, 2 en tablet, 1 en movil).




## Precios por servicio dentro del modal

### Concepto
Agregar una propiedad `pricing` al tipo `Service` que puede ser:
- **Planes** (como el TMS): array de `{ name, price, period, features[] }`
- **Precio único**: `{ price, period, description }`
- **Cotización**: sin precios, solo botón "Solicitar Cotización" vía WhatsApp

Cada modal mostrará un botón "Ver Precios" que expande una sección de precios inline (dentro del mismo modal), sin navegar a otra página. El TMS es la excepción: mantiene su botón que navega a `/pricing` porque ya tiene su página dedicada con checkout de Stripe.

### Estructura de datos

```typescript
interface ServicePricing {
  type: 'plans' | 'fixed' | 'quote';
  plans?: { name: string; price: number; period: string; features: string[] }[];
  fixedPrice?: { amount: number; period: string; note?: string };
}
```

Cada servicio en el array `services` recibirá su `pricing` con los datos correspondientes. Los precios exactos se dejan como placeholder para que los ajustes después.

### Cambios en el modal
- Botón "Ver Precios" debajo de beneficios (todos los servicios, no solo TMS)
- Al pulsar, se expande una sección dentro del modal:
  - **Plans**: mini-cards lado a lado con precio y features
  - **Fixed**: precio destacado con descripción
  - **Quote**: mensaje "Precio personalizado" + botón WhatsApp
- El TMS mantiene su navegación a `/pricing`

### Archivos a modificar
- `src/components/landing/ServicesSection.tsx` — agregar `pricing` a la interfaz, datos a cada servicio, y renderizar la sección de precios expandible en el modal

### Nota
Los precios se colocarán como valores placeholder (ej: $200, $500). Podrás ajustarlos después indicándome los montos correctos.


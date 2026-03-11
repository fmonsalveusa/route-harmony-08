

## Pagos directos por Stripe para servicios de la landing

### Resumen

Habilitar checkout de Stripe en 5 servicios (Tracking, Curso, Asesoría, Permisos, Auditorías). Dispatching y Leasing se mantienen solo WhatsApp. TMS mantiene su `/pricing`.

### 1. Crear productos y precios en Stripe

| Servicio | Tipo | Monto | Modo |
|----------|------|-------|------|
| Tracking Up App | Recurrente | $49/mes | subscription |
| Curso de Dispatcher | Único | $997 | payment |
| Asesoría Personal | Único | $150 | payment |
| Trámite de Permisos (DOT, MC#) | Único | $1,500 | payment |
| Auditorías FMCSA | Único | $500 | payment |

Se crearán usando las herramientas de Stripe disponibles.

### 2. Nueva Edge Function: `create-service-checkout`

Una sola función que recibe `priceId` y `mode` ("payment" o "subscription"), crea la sesión de Stripe Checkout y devuelve la URL. No requiere autenticación (checkout público para visitantes de la landing). Busca cliente existente por email si se proporciona.

### 3. Cambios en datos (`servicesData.ts`)

Agregar `stripeConfig` opcional al tipo `Service`:
```typescript
stripeConfig?: {
  priceId: string;
  mode: "payment" | "subscription";
};
```

Los 5 servicios con Stripe tendrán esta propiedad. Dispatching y Leasing no la tendrán.

### 4. Cambios en UI (`ServicePricingSection.tsx`)

Cuando el servicio tiene `stripeConfig`, agregar un botón "Pagar Ahora" debajo del precio que:
- Llama a `create-service-checkout` con el `priceId` y `mode`
- Abre la URL de Stripe Checkout en nueva pestaña

Los servicios sin `stripeConfig` mantienen solo el botón de WhatsApp.

### 5. Archivos a crear/modificar

- **Crear**: `supabase/functions/create-service-checkout/index.ts`
- **Modificar**: `supabase/config.toml` (agregar verify_jwt = false)
- **Modificar**: `src/components/landing/servicesData.ts` (agregar stripeConfig)
- **Modificar**: `src/components/landing/ServicePricingSection.tsx` (botón de pago)


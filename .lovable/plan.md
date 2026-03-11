

## Notificaciones de Pagos de Servicios

### Cambios necesarios para usar `developerup.pro@gmail.com`

**1. Agregar secret `NOTIFICATION_EMAIL`**
- Crear secret con valor `developerup.pro@gmail.com` 
- Este será el destinatario de notificaciones de pagos de servicios de la landing

**2. Modificar `stripe-webhook/index.ts`**
- En el case `checkout.session.completed`, detectar cuando NO hay `tenant_id` (pago de servicio de landing vs suscripción TMS)
- Recuperar los line items para identificar qué servicio se compró
- Enviar email de notificación usando Gmail SMTP (ya configurado)
- Email incluirá: nombre del servicio, monto, email del cliente, fecha

**3. Mapeo de Price IDs a nombres de servicio**
```text
price_1T9sFL75IaXwYE4pkCmrRr29 → Tracking Up App
price_1T9sFg75IaXwYE4pPyraBfIp → Curso de Dispatcher  
price_1T9sG675IaXwYE4pXFW1sCbB → Asesoría Personal
price_1T9sGW75IaXwYE4pLeZmCEqr → Trámite de Permisos
price_1T9sGz75IaXwYE4pMnE6REhl → Auditorías FMCSA
```

### Archivos a modificar
- `supabase/functions/stripe-webhook/index.ts` - agregar lógica de notificación
- Configurar nuevo secret `NOTIFICATION_EMAIL`


// Fuente única de los mensajes de WhatsApp: la usan las Edge Functions y la página WhatsApp del TMS.
// Sin imports para que funcione igual en Deno y en Vite.

export interface TemplateVariable {
  key: string;
  description: string;
  sample: string;
}

export interface TemplateDefinition {
  key: string;
  title: string;
  description: string;
  body: string;
  variables: TemplateVariable[];
}

export interface AutomationDefinition {
  id: string;
  title: string;
  description: string;
  /** Columna booleana en tenants que prende/apaga el aviso */
  toggle: string;
  templates: TemplateDefinition[];
}

const v = (key: string, description: string, sample: string): TemplateVariable => ({ key, description, sample });

const LOAD_VARS = [
  v('carga', 'Número de la carga', 'T2Y-459256'),
  v('driver', 'Nombre del driver', 'Javier Ruiz'),
  v('ciudad_pickup', 'Ciudad del primer pickup', 'Rincon, GA'),
  v('ciudad_entrega', 'Ciudad de la última entrega', 'Virginia Beach, VA'),
];

const DRIVER_NAME_VARS = [
  v('nombre', 'Primer nombre del driver', 'Pedro'),
  v('driver', 'Nombre completo del driver', 'Pedro Martinez'),
];

const STOP_VARS = [
  ...DRIVER_NAME_VARS,
  v('carga', 'Número de la carga', 'T2Y-459256'),
  v('ciudad', 'Ciudad de la parada', 'Columbia, SC'),
  v('horario', 'Horario de la parada', 'entre las 8:00 am y las 3:00 pm'),
];

const EXPIRY_VARS = [
  v('documento', 'Documento y dueño, en minúscula', 'la licencia de conducir de Javier Ruiz'),
  v('Documento', 'Documento y dueño, con mayúscula inicial', 'La licencia de conducir de Javier Ruiz'),
  v('fecha', 'Fecha de vencimiento', '10/15/2026'),
  v('dias', 'Días que faltan', '30'),
];

const MAINT_VARS = [
  v('unidad', 'Unidad del camión', 'Unit #241'),
  v('mantenimiento', 'Tipo de mantenimiento', 'Oil Change'),
  v('driver', 'Nombre del driver', 'Javier Ruiz'),
];

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    id: 'load_assigned',
    title: 'Carga asignada',
    description: 'Al asignar una carga a un driver (o reasignarla a otro).',
    toggle: 'wa_load_assigned',
    templates: [{
      key: 'load_assigned',
      title: 'Mensaje',
      description: 'Se envía al grupo del driver.',
      body: 'La carga #{carga} ha sido asignada a ti. Toda la información de la carga está en la app móvil.\nPor favor déjanos saber a qué hora estimas la llegada al Pick up.',
      variables: LOAD_VARS,
    }],
  },
  {
    id: 'load_delivered',
    title: 'Carga completada',
    description: 'Cuando la carga está Delivered y ya tiene POD.',
    toggle: 'wa_load_delivered',
    templates: [{
      key: 'load_delivered',
      title: 'Mensaje',
      description: 'Se envía al grupo del driver.',
      body: 'La carga #{carga} ha sido completada exitosamente. Las fotos de la carga y el POD han sido recibidos.',
      variables: LOAD_VARS,
    }],
  },
  {
    id: 'pod_reminder',
    title: 'Recordatorio de POD',
    description: 'A las 2 horas de entregada sin POD. Máximo 3 veces, una por día, de 7am a 9pm.',
    toggle: 'wa_pod_reminders',
    templates: [{
      key: 'pod_reminder',
      title: 'Mensaje',
      description: 'Se envía al grupo del driver.',
      body: 'La carga #{carga} fue marcada como entregada, pero todavía no hemos recibido el POD. Por favor súbelo en la app móvil lo antes posible; lo necesitamos para cobrar la carga.',
      variables: [...LOAD_VARS, v('recordatorio', 'Número de recordatorio (1 a 3)', '1')],
    }],
  },
  {
    id: 'daily_reminders',
    title: 'Recordatorio diario de pickups y entregas',
    description: 'Cada mañana a las 7am con las paradas programadas para hoy.',
    toggle: 'wa_daily_reminders',
    templates: [
      {
        key: 'daily_pickup',
        title: 'Un pickup',
        description: 'Cuando el driver tiene una sola parada hoy y es un pickup.',
        body: 'Buen día {nombre}, espero que estés muy bien. Le recordamos que hoy tenemos el pickup de la carga #{carga} programado en {ciudad} {horario}. ¿A qué hora estimas la llegada?',
        variables: STOP_VARS,
      },
      {
        key: 'daily_delivery',
        title: 'Una entrega',
        description: 'Cuando el driver tiene una sola parada hoy y es una entrega.',
        body: 'Buen día {nombre}, espero que estés muy bien. Le recordamos que hoy tenemos la entrega de la carga #{carga} programada en {ciudad} {horario}. ¿A qué hora estimas la entrega?',
        variables: STOP_VARS,
      },
      {
        key: 'daily_multiple',
        title: 'Varias paradas',
        description: 'Cuando el driver tiene más de una parada hoy.',
        body: 'Buen día {nombre}, espero que estés muy bien. Le recordamos lo programado para hoy:\n{paradas}\n¿A qué hora estimas llegar a cada parada?',
        variables: [...DRIVER_NAME_VARS, v('paradas', 'Lista de paradas, una por línea', '• Pickup de la carga #T2Y-459256 en Rincon, GA a las 8:00 am\n• Entrega de la carga #A-1001 en Columbia, SC entre las 1:00 pm y las 5:00 pm')],
      },
    ],
  },
  {
    id: 'maintenance_alerts',
    title: 'Mantenimiento del camión',
    description: 'Solo Company Drivers. Al llegar al 80% (Approaching) y al 100% (Overdue) del intervalo. Un aviso de cada uno por ciclo de servicio.',
    toggle: 'wa_maintenance_alerts',
    templates: [
      {
        key: 'maintenance_approaching',
        title: 'Approaching por millas',
        description: 'Al 80% de las millas del intervalo.',
        body: 'El camión {unidad} lleva {millas} de {intervalo} millas desde su último {mantenimiento}. Por favor coordina el mantenimiento pronto.',
        variables: [...MAINT_VARS, v('millas', 'Millas recorridas desde el servicio', '12,400'), v('intervalo', 'Millas del intervalo', '15,000')],
      },
      {
        key: 'maintenance_overdue',
        title: 'Overdue por millas',
        description: 'Al completar las millas del intervalo.',
        body: 'El camión {unidad} completó {intervalo} millas desde su último {mantenimiento}. Por favor coordina el mantenimiento.',
        variables: [...MAINT_VARS, v('millas', 'Millas recorridas desde el servicio', '15,120'), v('intervalo', 'Millas del intervalo', '15,000')],
      },
      {
        key: 'maintenance_date_approaching',
        title: 'Approaching por fecha',
        description: 'Mantenimientos por fecha, 30 días antes.',
        body: 'El {mantenimiento} del camión {unidad} vence el {fecha}. Por favor coordina el mantenimiento pronto.',
        variables: [...MAINT_VARS, v('fecha', 'Fecha en que vence', '10/15/2026')],
      },
      {
        key: 'maintenance_date_overdue',
        title: 'Overdue por fecha',
        description: 'Mantenimientos por fecha, al vencer.',
        body: 'El {mantenimiento} del camión {unidad} venció el {fecha}. Por favor coordina el mantenimiento.',
        variables: [...MAINT_VARS, v('fecha', 'Fecha en que venció', '10/15/2026')],
      },
    ],
  },
  {
    id: 'payment_receipts',
    title: 'Recibo de pago',
    description: 'Al marcar un pago como Paid. Se adjunta el recibo en PDF.',
    toggle: 'wa_payment_receipts',
    templates: [
      {
        key: 'payment_single',
        title: 'Pago de una carga',
        description: 'Pagos de driver o investor de una sola carga.',
        body: 'Pago procesado por {monto} — Carga #{carga}. Adjunto el recibo de pago.',
        variables: [v('monto', 'Monto pagado', '$1,250.00'), v('carga', 'Número de la carga', 'T2Y-459256'), v('beneficiario', 'Nombre del beneficiario', 'Javier Ruiz')],
      },
      {
        key: 'payment_batch',
        title: 'Pago de varias cargas',
        description: 'Pagos en lote y pagos de dispatcher.',
        body: 'Pago procesado por {monto}. Anexo el recibo de pago con el detalle de las cargas incluidas en este pago.',
        variables: [v('monto', 'Monto pagado', '$3,480.00'), v('beneficiario', 'Nombre del beneficiario', 'Javier Ruiz'), v('cantidad', 'Cantidad de pagos incluidos', '3')],
      },
    ],
  },
  {
    id: 'expiry_alerts',
    title: 'Vencimiento de documentos',
    description: 'Licencia y medical card del driver; seguro, registration y annual inspection del camión.',
    toggle: 'wa_expiry_alerts',
    templates: [
      {
        key: 'expiry_soon',
        title: 'A 30 y 7 días',
        description: 'Antes del vencimiento.',
        body: 'Recordatorio: {documento} vence el {fecha} (en {dias} días). Por favor gestiona la renovación y envíanos la copia actualizada.',
        variables: EXPIRY_VARS,
      },
      {
        key: 'expiry_today',
        title: 'El día que vence',
        description: 'El mismo día del vencimiento.',
        body: '{Documento} vence hoy ({fecha}). Por favor gestiona la renovación y envíanos la copia actualizada.',
        variables: EXPIRY_VARS,
      },
      {
        key: 'expiry_overdue',
        title: 'Vencido (cada semana)',
        description: 'Cada 7 días mientras siga vencido.',
        body: '{Documento} venció el {fecha} y sigue pendiente de renovación. Por favor envíanos la copia actualizada lo antes posible.',
        variables: EXPIRY_VARS,
      },
    ],
  },
  {
    id: 'admin_report',
    title: 'Reporte diario de administración',
    description: 'Cada mañana a las 8am al grupo de administración: cargas activas, pickups y entregas de hoy, entregadas sin POD, drivers sin carga, pagos pendientes, mantenimientos vencidos y facturado de la semana. El formato no es editable.',
    toggle: 'wa_admin_report',
    templates: [],
  },
];

export const DEFAULT_TEMPLATES: Record<string, string> = Object.fromEntries(
  AUTOMATIONS.flatMap((a) => a.templates.map((t) => [t.key, t.body])),
);

export const TEMPLATE_TITLES: Record<string, string> = Object.fromEntries(
  AUTOMATIONS.flatMap((a) => a.templates.map((t) => [t.key, a.templates.length > 1 ? `${a.title} — ${t.title}` : a.title])),
);

/** Reemplaza {variable}; las variables desconocidas quedan como están */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body
    .replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined || vars[key] === null ? match : String(vars[key])))
    .replace(/[ \t]+([.,;?!])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

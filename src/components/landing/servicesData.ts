import { Radio, Key, GraduationCap, MapPin, Users, FileCheck, LayoutDashboard, type LucideIcon } from "lucide-react";

import imgDispatching from "@/assets/services/dispatching.jpg";
import imgLeasing from "@/assets/landing-boxtruck.jpg";
import imgCurso from "@/assets/services/curso-dispatcher.jpg";
import imgTracking from "@/assets/services/tracking-app.jpg";
import imgAsesoria from "@/assets/services/asesoria.jpg";
import imgPermisos from "@/assets/services/permisos.jpg";
import imgTms from "@/assets/services/tms-dashboard.jpg";
import imgAuditoria from "@/assets/services/auditoria-fmcsa.jpg";

export interface PricingPlan {
  name: string;
  price: number;
  period: string;
  features: string[];
}

export interface ServicePricing {
  type: "plans" | "fixed" | "page";
  plans?: PricingPlan[];
  fixedPrice?: { amount: number; period: string; note?: string };
  /** For type "page", navigate to this path instead of showing inline pricing */
  pricingPath?: string;
}

export interface StripeConfig {
  priceId: string;
  mode: "payment" | "subscription";
}

export interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
  image: string;
  details: string;
  benefits: string[];
  cta: { label: string; href: string };
  pricing: ServicePricing;
  stripeConfig?: StripeConfig;
}

export const services: Service[] = [
  {
    icon: Radio,
    title: "Dispatching para MC# propio",
    description: "Servicio profesional de dispatch para clientes que ya cuentan con su propio MC#. Maximiza tus ganancias con cargas bien negociadas.",
    image: imgDispatching,
    details: "Nuestro equipo de dispatchers profesionales se encarga de encontrar y negociar las mejores cargas para tu camión. Trabajamos con los principales load boards y brokers del mercado para asegurar las tarifas más competitivas. Operamos 24/7 para que nunca pierdas una oportunidad.",
    benefits: [
      "Negociación agresiva de tarifas por encima del mercado",
      "Acceso a load boards premium (DAT, Truckstop, etc.)",
      "Soporte 24/7 en español e inglés",
      "Reportes semanales de rendimiento y ganancias",
      "Planificación de rutas optimizadas para menos millas vacías",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20servicio%20de%20Dispatching%20para%20mi%20MC%23" },
    pricing: {
      type: "plans",
      plans: [
        { name: "Por Camión", price: 250, period: "/semana", features: ["1 camión", "Dispatch 24/7", "Reportes semanales"] },
        { name: "Flota", price: 200, period: "/semana por camión", features: ["3+ camiones", "Dispatch 24/7", "Account manager dedicado", "Reportes avanzados"] },
      ],
    },
  },
  {
    icon: Key,
    title: "Leasing bajo nuestro MC#",
    description: "Opera bajo nuestro MC# sin complicaciones. Nosotros manejamos los permisos, tú te concentras en manejar.",
    image: imgLeasing,
    details: "Si tienes tu camión pero no cuentas con MC# propio, puedes operar bajo nuestra autoridad. Nos encargamos de todo el papeleo, seguros y compliance mientras tú generas ingresos desde el primer día. Sin inversión inicial en permisos.",
    benefits: [
      "Opera legalmente desde el día uno sin MC# propio",
      "Cobertura de seguro incluida bajo nuestra póliza",
      "Compliance y safety management incluidos",
      "Facturación y cobro a brokers gestionado por nosotros",
      "Pagos semanales puntuales",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20Leasing%20bajo%20su%20MC%23" },
    pricing: {
      type: "plans",
      plans: [
        { name: "Box Truck", price: 300, period: "/semana", features: ["Seguro incluido", "Dispatch 24/7", "Compliance y safety", "Pagos semanales"] },
        { name: "Semi Truck", price: 350, period: "/semana", features: ["Seguro incluido", "Dispatch 24/7", "Compliance y safety", "Pagos semanales", "Account manager dedicado"] },
      ],
    },
  },
  {
    icon: LayoutDashboard,
    title: "Dispatch Up TMS",
    description: "Software de gestión de transporte completo. Control de cargas, pagos, conductores, flota y reportes en una sola plataforma.",
    image: imgTms,
    details: "Dispatch Up TMS es nuestra plataforma todo-en-uno para la gestión de empresas de transporte. Controla cargas, pagos a conductores, comisiones de dispatchers, flota, gastos, facturación y reportes financieros desde un solo lugar. Diseñado por y para transportistas hispanos.",
    benefits: [
      "Gestión completa de cargas con estados en tiempo real",
      "Cálculo automático de pagos a conductores y dispatchers",
      "Control de flota con documentos y vencimientos",
      "Dashboard con métricas financieras y de rendimiento",
      "Facturación automática a brokers con envío por email",
      "App móvil para conductores con tracking integrado",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20software%20Load%20Up%20TMS" },
    pricing: { type: "page", pricingPath: "/pricing" },
  },
  {
    icon: MapPin,
    title: "Tracking Up App",
    description: "Aplicación de tracking en tiempo real para flotas. Monitorea la ubicación y estado de cada carga.",
    image: imgTracking,
    details: "Nuestra aplicación de rastreo en tiempo real te permite monitorear cada camión de tu flota desde cualquier dispositivo. Los conductores actualizan su ubicación y estado de carga directamente desde su teléfono, y tú ves todo en un mapa interactivo.",
    benefits: [
      "Rastreo GPS en tiempo real de toda tu flota",
      "Actualizaciones automáticas de estado de carga",
      "Historial completo de rutas y paradas",
      "Notificaciones de llegada y entrega",
      "Compatible con iOS y Android",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20la%20app%20Tracking%20Up" },
    pricing: {
      type: "fixed",
      fixedPrice: { amount: 49, period: "/mes", note: "Incluido gratis con el servicio de Dispatching" },
    },
    stripeConfig: { priceId: "price_1T9tJ175IaXwYE4pEqVJqVlW", mode: "subscription" },
  },
  {
    icon: Users,
    title: "Asesoría Personal",
    description: "Consultoría personalizada para potenciar tu negocio de transporte. Estrategia, finanzas y operaciones.",
    image: imgAsesoria,
    details: "Sesiones de consultoría uno a uno con expertos en la industria del transporte. Analizamos tu operación actual, identificamos oportunidades de mejora y diseñamos un plan de acción para aumentar tus ingresos y reducir costos.",
    benefits: [
      "Análisis completo de tu operación actual",
      "Plan estratégico personalizado de crecimiento",
      "Asesoría en finanzas y control de gastos",
      "Guía para expandir tu flota de manera rentable",
      "Seguimiento mensual de resultados",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20la%20Asesor%C3%ADa%20Personal" },
    pricing: {
      type: "fixed",
      fixedPrice: { amount: 150, period: "/sesión", note: "Consultoría personalizada de 1 hora con expertos en transporte" },
    },
    stripeConfig: { priceId: "price_1T9tK575IaXwYE4pKcQDlrSH", mode: "payment" },
  },
  {
    icon: FileCheck,
    title: "Trámite de Permisos (DOT, MC#)",
    description: "Gestión completa de permisos y licencias federales. DOT, MC#, IFTA y más. Sin estrés.",
    image: imgPermisos,
    details: "Nos encargamos de todo el proceso de obtención y renovación de permisos federales para tu empresa de transporte. Desde el registro DOT inicial hasta el MC#, IFTA, BOC-3 y UCR. Proceso rápido y sin complicaciones.",
    benefits: [
      "Registro DOT y obtención de MC# completo",
      "Trámite de IFTA, BOC-3 y UCR",
      "Renovaciones automáticas antes del vencimiento",
      "Asesoría sobre requisitos de compliance",
      "Seguimiento del estatus de cada trámite",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20Tr%C3%A1mite%20de%20Permisos%20DOT%20MC%23" },
    pricing: {
      type: "fixed",
      fixedPrice: { amount: 1500, period: "único", note: "Incluye DOT, MC#, BOC-3, IFTA y UCR" },
    },
    stripeConfig: { priceId: "price_1T9tKe75IaXwYE4pAZC1XmiQ", mode: "payment" },
  },
  {
    icon: GraduationCap,
    title: "Curso de Dispatcher",
    description: "Formación profesional completa para convertirte en un dispatcher exitoso. Aprende negociación, rutas y más.",
    image: imgCurso,
    details: "Programa de formación intensivo diseñado para personas que quieren iniciar su carrera como dispatcher de carga. Aprenderás desde lo básico hasta técnicas avanzadas de negociación, uso de load boards, planificación de rutas y gestión de flotas.",
    benefits: [
      "Curso 100% en español con material actualizado",
      "Práctica en vivo con load boards reales",
      "Técnicas de negociación con brokers",
      "Certificado de finalización",
      "Acceso a comunidad de dispatchers graduados",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20Curso%20de%20Dispatcher" },
    pricing: {
      type: "fixed",
      fixedPrice: { amount: 997, period: "único", note: "Incluye material, práctica en vivo y certificado" },
    },
    stripeConfig: { priceId: "price_1T9tJW75IaXwYE4pxjach0UV", mode: "payment" },
  },
  {
    icon: FileCheck,
    title: "Asistencia en Auditorías del FMCSA",
    description: "Te acompañamos en todo el proceso de auditoría federal. Preparación, documentación y respuesta ante el FMCSA.",
    image: imgAuditoria,
    details: "Nuestro equipo de expertos en compliance te guía paso a paso durante las auditorías del FMCSA. Desde la preparación de documentos hasta la respuesta formal, nos aseguramos de que tu empresa cumpla con todos los requisitos federales y evite sanciones o multas.",
    benefits: [
      "New Entrance Audit: preparación completa para nuevos MC#",
      "Revisión y organización de archivos de seguridad (driver files)",
      "Preparación de políticas de drogas y alcohol (Drug & Alcohol Program)",
      "Asistencia en auditorías de horas de servicio (HOS)",
      "Respuesta y plan correctivo ante hallazgos del FMCSA",
      "Asesoría continua para mantener un safety rating satisfactorio",
    ],
    cta: { label: "Contactar por WhatsApp", href: "https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20la%20Asistencia%20en%20Auditor%C3%ADas%20del%20FMCSA" },
    pricing: {
      type: "fixed",
      fixedPrice: { amount: 500, period: "por auditoría", note: "Preparación completa, documentación y respuesta ante el FMCSA" },
    },
    stripeConfig: { priceId: "price_1T9tLD75IaXwYE4puYvA0nIa", mode: "payment" },
  },
];

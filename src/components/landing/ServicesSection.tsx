import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Key, GraduationCap, MapPin, Users, FileCheck, LayoutDashboard, Check, MessageCircle, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import imgDispatching from "@/assets/services/dispatching.jpg";
import imgLeasing from "@/assets/landing-boxtruck.jpg";
import imgCurso from "@/assets/services/curso-dispatcher.jpg";
import imgTracking from "@/assets/services/tracking-app.jpg";
import imgAsesoria from "@/assets/services/asesoria.jpg";
import imgPermisos from "@/assets/services/permisos.jpg";
import imgTms from "@/assets/services/tms-dashboard.jpg";

interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
  image: string;
  details: string;
  benefits: string[];
  cta: { label: string; href: string };
}

const services: Service[] = [
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
  },
  {
    icon: LayoutDashboard,
    title: "Load Up TMS",
    description: "Software de gestión de transporte completo. Control de cargas, pagos, conductores, flota y reportes en una sola plataforma.",
    image: imgTms,
    details: "Load Up TMS es nuestra plataforma todo-en-uno para la gestión de empresas de transporte. Controla cargas, pagos a conductores, comisiones de dispatchers, flota, gastos, facturación y reportes financieros desde un solo lugar. Diseñado por y para transportistas hispanos.",
    benefits: [
      "Gestión completa de cargas con estados en tiempo real",
      "Cálculo automático de pagos a conductores y dispatchers",
      "Control de flota con documentos y vencimientos",
      "Dashboard con métricas financieras y de rendimiento",
      "Facturación automática a brokers con envío por email",
      "App móvil para conductores con tracking integrado",
    ],
    cta: { label: "Registrarse ahora", href: "#onboarding" },
  },
];

export function ServicesSection() {
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const selected = selectedService !== null ? services[selectedService] : null;

  return (
    <section id="servicios" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Nuestros Servicios</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Soluciones integrales para el transporte de carga. Desde dispatch hasta permisos federales.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg hover:border-accent/40 transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedService(i)}
            >
              <div className="aspect-video overflow-hidden">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <s.icon className="text-accent" size={20} />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      <Dialog open={selectedService !== null} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <selected.icon className="text-accent" size={20} />
                  </div>
                  <DialogTitle className="text-xl">{selected.title}</DialogTitle>
                </div>
                <DialogDescription className="text-base leading-relaxed pt-2">
                  {selected.details}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <h4 className="font-semibold text-foreground text-sm">Beneficios</h4>
                <ul className="space-y-2">
                  {selected.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="text-accent mt-0.5 shrink-0" size={16} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                {selected.cta.href.startsWith("#") ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedService(null);
                      document.querySelector(selected.cta.href)?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {selected.cta.label}
                  </Button>
                ) : (
                  <Button className="w-full gap-2" asChild>
                    <a href={selected.cta.href} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={18} />
                      {selected.cta.label}
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

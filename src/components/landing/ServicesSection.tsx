import { motion } from "framer-motion";
import { Radio, Key, GraduationCap, MapPin, Users, FileCheck, LayoutDashboard } from "lucide-react";

const services = [
  {
    icon: Radio,
    title: "Dispatching para MC# propio",
    description: "Servicio profesional de dispatch para clientes que ya cuentan con su propio MC#. Maximiza tus ganancias con cargas bien negociadas.",
  },
  {
    icon: Key,
    title: "Leasing bajo nuestro MC#",
    description: "Opera bajo nuestro MC# sin complicaciones. Nosotros manejamos los permisos, tú te concentras en manejar.",
  },
  {
    icon: GraduationCap,
    title: "Curso de Dispatcher",
    description: "Formación profesional completa para convertirte en un dispatcher exitoso. Aprende negociación, rutas y más.",
  },
  {
    icon: MapPin,
    title: "Tracking Up App",
    description: "Aplicación de tracking en tiempo real para flotas. Monitorea la ubicación y estado de cada carga.",
  },
  {
    icon: Users,
    title: "Asesoría Personal",
    description: "Consultoría personalizada para potenciar tu negocio de transporte. Estrategia, finanzas y operaciones.",
  },
  {
    icon: FileCheck,
    title: "Trámite de Permisos (DOT, MC#)",
    description: "Gestión completa de permisos y licencias federales. DOT, MC#, IFTA y más. Sin estrés.",
  },
  {
    icon: LayoutDashboard,
    title: "Load Up TMS",
    description: "Software de gestión de transporte completo. Control de cargas, pagos, conductores, flota y reportes en una sola plataforma.",
  },
];

export function ServicesSection() {
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
              className="group bg-card border rounded-xl p-6 hover:shadow-lg hover:border-accent/40 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <s.icon className="text-accent" size={24} />
              </div>
              <h3 className="font-bold text-foreground text-lg mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

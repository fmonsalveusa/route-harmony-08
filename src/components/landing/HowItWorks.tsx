import { motion } from "framer-motion";
import { TrendingUp, Shield, Clock, Globe, HeadphonesIcon, BarChart3 } from "lucide-react";

const advantages = [
  { icon: TrendingUp, title: "Tarifas Competitivas", desc: "Negociamos agresivamente para obtener las mejores tarifas del mercado." },
  { icon: Shield, title: "Compliance Completo", desc: "Mantenemos tus permisos y documentos al día con el FMCSA." },
  { icon: Clock, title: "Soporte 24/7", desc: "Nuestro equipo está disponible las 24 horas, los 7 días de la semana." },
  { icon: Globe, title: "Cobertura Nacional", desc: "Operamos en los 48 estados contiguos de Estados Unidos." },
  { icon: HeadphonesIcon, title: "Atención en Español", desc: "Todo nuestro equipo habla español e inglés para tu comodidad." },
  { icon: BarChart3, title: "Reportes Detallados", desc: "Dashboard con métricas en tiempo real de tu operación y ganancias." },
];

export function HowItWorks() {
  return (
    <section id="ventajas" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            La Ventaja <span className="text-accent">Dispatch Up</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            ¿Por qué cientos de transportistas confían en nosotros?
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {advantages.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4 items-start"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <a.icon className="text-accent" size={22} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base mb-1">{a.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{a.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

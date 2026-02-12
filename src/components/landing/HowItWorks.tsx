import { motion } from "framer-motion";
import { Phone, ListChecks, Truck } from "lucide-react";

const steps = [
  { icon: Phone, title: "Contáctanos", desc: "Escríbenos por WhatsApp o llena el formulario de registro." },
  { icon: ListChecks, title: "Selecciona tu servicio", desc: "Elige el plan que mejor se adapte a tus necesidades." },
  { icon: Truck, title: "Comienza a operar", desc: "Te activamos rápidamente y empiezas a generar ingresos." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 bg-[hsl(214,52%,12%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">¿Cómo Funciona?</h2>
          <p className="text-white/60 max-w-xl mx-auto">En 3 simples pasos estarás operando con nosotros.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-5">
                <s.icon className="text-accent" size={28} />
              </div>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 bg-accent text-accent-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {i + 1}
              </span>
              <h3 className="text-white font-bold text-xl mb-2">{s.title}</h3>
              <p className="text-white/60 text-sm">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

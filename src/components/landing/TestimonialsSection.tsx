import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";

const testimonials = {
  es: [
    { name: "Carlos M.", truck: "Box Truck", location: "Houston, TX", quote: "Desde que trabajo con Dispatch Up, mis ganancias aumentaron un 40%. El equipo siempre responde rápido y en español.", rating: 5 },
    { name: "José R.", truck: "Hotshot", location: "Dallas, TX", quote: "Me ayudaron a operar bajo su MC# desde el primer día. Sin complicaciones y con pagos puntuales cada semana.", rating: 5 },
    { name: "Miguel A.", truck: "Box Truck", location: "Atlanta, GA", quote: "El mejor servicio de dispatch que he tenido. Cargas bien pagadas y rutas inteligentes que me ahorran millas vacías.", rating: 5 },
  ],
  en: [
    { name: "Carlos M.", truck: "Box Truck", location: "Houston, TX", quote: "Since working with Dispatch Up, my earnings increased by 40%. The team always responds quickly and in Spanish.", rating: 5 },
    { name: "José R.", truck: "Hotshot", location: "Dallas, TX", quote: "They helped me operate under their MC# from day one. No hassle and punctual weekly payments.", rating: 5 },
    { name: "Miguel A.", truck: "Box Truck", location: "Atlanta, GA", quote: "Best dispatch service I've had. Well-paid loads and smart routes that save me empty miles.", rating: 5 },
  ],
};

export function TestimonialsSection() {
  const { lang } = useLandingLang();
  const items = testimonials[lang];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((p) => (p + 1) % items.length), 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  return (
    <section className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">
            {lang === "es" ? "Testimonios" : "Testimonials"}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2">
            {lang === "es" ? "Lo que dicen nuestros " : "What our "}
            <span className="text-accent">{lang === "es" ? "drivers" : "drivers say"}</span>
          </h2>
        </motion.div>

        <div className="relative mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="bg-card border rounded-2xl p-8 sm:p-12 shadow-sm text-center"
            >
              <div className="flex justify-center gap-1 mb-6">
                {Array.from({ length: items[current].rating }).map((_, i) => (
                  <Star key={i} size={20} className="fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" />
                ))}
              </div>

              <blockquote className="text-lg sm:text-xl text-foreground font-medium leading-relaxed mb-8 max-w-2xl mx-auto">
                "{items[current].quote}"
              </blockquote>

              <div>
                <p className="font-bold text-foreground text-lg">{items[current].name}</p>
                <p className="text-muted-foreground text-sm">
                  {items[current].truck} · {items[current].location}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrent((p) => (p - 1 + items.length) % items.length)}
              className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>

            <div className="flex gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-accent" : "w-2 bg-border"}`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrent((p) => (p + 1) % items.length)}
              className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight size={18} className="text-foreground" />
            </button>
          </div>
        </div>

        {/* Trust banner */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground text-sm font-medium">
            {lang === "es"
              ? "Más de 200+ owner-operators confían en Dispatch Up"
              : "200+ owner-operators trust Dispatch Up"}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

import { motion } from "framer-motion";
import { ArrowRight, CalendarIcon } from "lucide-react";
import heroImg from "@/assets/landing-hero.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function HeroSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const badges = [
    { emoji: "🚛", text: lang === "es" ? "5,000+ Cargas" : "5,000+ Loads" },
    { emoji: "🇺🇸", text: lang === "es" ? "48 Estados" : "48 States" },
    { emoji: "📞", text: "24/7" },
    { emoji: "🌐", text: "ES / EN" },
  ];

  return (
    <section className="relative mt-16 flex items-center overflow-hidden bg-[hsl(214,52%,12%)]" style={{ minHeight: 'max(540px, calc(56vw - 4rem))' }}>
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Fleet"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105 opacity-35 blur-sm"
        />
        <img
          src={heroImg}
          alt="Fleet"
          className="absolute inset-0 w-full h-full object-contain object-center"
        />
        <div className="absolute inset-0 bg-[hsl(214,52%,12%)/0.7]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36 w-full">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.1] mb-4">
              {lang === "es" ? "Dispatch & Transporte" : "Dispatch & Transport"}
            </h1>

            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-[hsl(28,92%,52%)] mb-6">
              {lang === "es" ? "Tu Socio en el Camino al Éxito" : "Your Partner on the Road to Success"}
            </p>

            <p className="text-lg sm:text-xl text-white/70 mb-10 leading-relaxed max-w-2xl mx-auto">
              {lang === "es"
                ? "Dispatch profesional, leasing de MC#, tracking en tiempo real y asesoría completa para tu negocio de transporte."
                : "Professional dispatch, MC# leasing, real-time tracking and full advisory for your transport business."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
            <a
              href="#onboarding"
              className="inline-flex items-center justify-center gap-2 bg-[hsl(28,92%,52%)] hover:bg-[hsl(28,92%,46%)] text-white font-bold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-[hsl(28,92%,52%)]/25 hover:shadow-xl hover:shadow-[hsl(28,92%,52%)]/30 hover:-translate-y-0.5"
            >
              {lang === "es" ? "Comenzar Registro" : "Start Registration"}
              <ArrowRight size={20} />
            </a>
            <a
              href="#meeting"
              className="inline-flex items-center justify-center gap-2 border-2 border-[hsl(152,60%,40%)] text-[hsl(152,60%,40%)] hover:bg-[hsl(152,60%,40%)] hover:text-white font-bold px-8 py-4 rounded-xl text-lg transition-all"
            >
              <CalendarIcon size={20} />
              {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {badges.map((b) => (
              <span
                key={b.text}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 px-4 py-2 rounded-full text-sm font-medium"
              >
                {b.emoji} {b.text}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}

import { motion } from "framer-motion";
import { CalendarIcon, ArrowRight } from "lucide-react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";

export function MeetingBanner() {
  const { lang } = useLandingLang();

  return (
    <section className="relative py-16 overflow-hidden bg-gradient-to-r from-[hsl(152,40%,18%)] via-[hsl(152,35%,22%)] to-[hsl(152,40%,18%)]">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(152,60%,40%),transparent_70%)]" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-5"
        >
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm items-center justify-center shrink-0">
            <CalendarIcon className="text-[hsl(152,60%,60%)]" size={28} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
              {lang === "es"
                ? "Habla con nuestro equipo en 15 min"
                : "Talk to our team in 15 min"}
            </h3>
            <p className="text-white/60 text-sm sm:text-base">
              {lang === "es"
                ? "Sin compromiso. Resolvemos tus dudas y te explicamos el proceso."
                : "No commitment. We answer your questions and explain the process."}
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <a
            href="#meeting"
            className="inline-flex items-center justify-center gap-2 bg-[hsl(152,60%,40%)] hover:bg-[hsl(152,60%,35%)] text-white font-bold px-8 py-4 rounded-xl text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap"
          >
            <CalendarIcon size={20} />
            {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
            <ArrowRight size={18} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

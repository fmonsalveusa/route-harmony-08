import { motion } from "framer-motion";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import { BookingWidget } from "@/components/booking/BookingWidget";
import t from "./landingTranslations";

// Agenda tipo Calendly: la misma de la página /agendar (horarios libres, invitación por email, reagendar/cancelar)
export function MeetingSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  return (
    <section id="meeting" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {tr.meetTitle1} <span className="text-accent">{tr.meetTitle2}</span>
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">{tr.meetSubtitle}</p>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li className="flex items-center gap-2">{tr.meetBullet1}</li>
              <li className="flex items-center gap-2">{tr.meetBullet2}</li>
              <li className="flex items-center gap-2">{tr.meetBullet3}</li>
              <li className="flex items-center gap-2">{tr.meetBullet4}</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <BookingWidget lang={lang} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

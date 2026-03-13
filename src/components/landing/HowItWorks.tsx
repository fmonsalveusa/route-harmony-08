import { motion } from "framer-motion";
import { TrendingUp, Shield, Clock, Globe, HeadphonesIcon, BarChart3 } from "lucide-react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function HowItWorks() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const advantages = [
    { icon: TrendingUp, title: tr.advRates, desc: tr.advRatesDesc },
    { icon: Shield, title: tr.advCompliance, desc: tr.advComplianceDesc },
    { icon: Clock, title: tr.advSupport, desc: tr.advSupportDesc },
    { icon: Globe, title: tr.advCoverage, desc: tr.advCoverageDesc },
    { icon: HeadphonesIcon, title: tr.advSpanish, desc: tr.advSpanishDesc },
    { icon: BarChart3, title: tr.advReports, desc: tr.advReportsDesc },
  ];

  return (
    <section id="ventajas" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {tr.advTitle1} <span className="text-accent">{tr.advTitle2}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{tr.advSubtitle}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {advantages.map((a, i) => (
            <motion.div key={a.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-4 items-start">
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

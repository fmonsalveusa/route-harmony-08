import { motion } from "framer-motion";
import { UserPlus, Truck, DollarSign, TrendingUp, Shield, Clock, Globe, HeadphonesIcon, BarChart3, CalendarIcon } from "lucide-react";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

const stepsEs = [
  { icon: UserPlus, num: "01", title: "Regístrate Gratis", desc: "Completa tu registro en menos de 2 minutos. 100% digital, sin costo." },
  { icon: CalendarIcon, num: "02", title: "Agenda una Reunión", desc: "Coordina una llamada con nuestro equipo para conocer tu negocio y necesidades." },
  { icon: Truck, num: "03", title: "Te Asignamos Cargas", desc: "Nuestro equipo negocia las mejores tarifas y te asigna cargas bien pagadas." },
  { icon: DollarSign, num: "04", title: "Gana Dinero", desc: "Recibe pagos semanales directos a tu cuenta. Sin sorpresas." },
];

const stepsEn = [
  { icon: UserPlus, num: "01", title: "Register Free", desc: "Complete your registration in less than 2 minutes. 100% digital, no cost." },
  { icon: CalendarIcon, num: "02", title: "Schedule a Meeting", desc: "Coordinate a call with our team to learn about your business and needs." },
  { icon: Truck, num: "03", title: "We Assign Loads", desc: "Our team negotiates the best rates and assigns you well-paid loads." },
  { icon: DollarSign, num: "04", title: "Earn Money", desc: "Receive weekly payments directly to your account. No surprises." },
];

export function HowItWorks() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const steps = lang === "es" ? stepsEs : stepsEn;

  const advantages = [
    { icon: TrendingUp, title: tr.advRates, desc: tr.advRatesDesc },
    { icon: Shield, title: tr.advCompliance, desc: tr.advComplianceDesc },
    { icon: Clock, title: tr.advSupport, desc: tr.advSupportDesc },
    { icon: Globe, title: tr.advCoverage, desc: tr.advCoverageDesc },
    { icon: HeadphonesIcon, title: tr.advSpanish, desc: tr.advSpanishDesc },
    { icon: BarChart3, title: tr.advReports, desc: tr.advReportsDesc },
  ];

  return (
    <section id="ventajas" className="py-20 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 3-Step Process */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">
            {lang === "es" ? "Cómo Funciona" : "How It Works"}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2">
            {lang === "es" ? "4 Pasos para " : "4 Steps to "}
            <span className="text-accent">{lang === "es" ? "Empezar" : "Get Started"}</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20" />

          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center mb-6">
                <step.icon size={32} className="text-accent" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shadow-md">
                  {step.num}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Advantages grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <h3 className="text-2xl font-bold text-foreground">
            {tr.advTitle1} <span className="text-accent">{tr.advTitle2}</span>
          </h3>
          <p className="text-muted-foreground mt-2">{tr.advSubtitle}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {advantages.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 items-start bg-card rounded-xl border p-5 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <a.icon className="text-accent" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm mb-1">{a.title}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{a.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
